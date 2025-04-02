import { ActivityElement, ActivityLogEntryCategory, ActivityStatus, Client, Logger, ServerTaskWaiter, SpaceRepository, SpaceServerTaskRepository, TaskState } from "@octopusdeploy/api-client";
import { OctoServerConnectionDetails } from "tasks/Utils/connection";
import { TaskWrapper } from "tasks/Utils/taskInput";
import { getInputParameters, InputParameters } from "./input-parameters";
import { ExecutionResult } from "../../Utils/executionResult";
import { getClient } from "../../Utils/client";

export interface WaitExecutionResult extends ExecutionResult {
    successful: boolean;
}

export class Waiter {
    constructor(readonly connection: OctoServerConnectionDetails, readonly task: TaskWrapper, readonly logger: Logger) { }

    public async run() {
        const inputParameters = getInputParameters(this.logger, this.task);

        const client = await getClient(this.connection, this.logger, "task", "wait", 6);

        const waitExecutionResults = inputParameters.showProgress ? await this.waitWithProgress(client, inputParameters) : await this.waitWithoutProgress(client, inputParameters);

        const spaceId = await this.getSpaceId(client, inputParameters.space);
        let failedDeploymentsCount = 0;
        waitExecutionResults.map((r) => {
            const url = `${this.connection.url}app#/${spaceId}/tasks/${r.serverTaskId}`;
            const context = this.getContext(r);
            if (r.successful) {
                this.logger.info?.(`Succeeded: ${url}`);
            } else {
                this.logger.warn?.(`Failed: ${url}`);
                failedDeploymentsCount++;
            }
            this.task.setOutputVariable(`${context}.completed_successfully`, r.successful.toString());
        });

        if (failedDeploymentsCount > 0) {
            this.task.setFailure(`${failedDeploymentsCount} ${failedDeploymentsCount == 1 ? "task" : "tasks"} failed.`);
            this.task.setOutputVariable("completed_successfully", "false");
        } else {
            this.task.setSuccess("All tasks completed successfully");
            this.task.setOutputVariable("completed_successfully", "true");
        }

        this.task.setOutputVariable("server_task_results", JSON.stringify(waitExecutionResults));
    }

    async getSpaceId(client: Client, spaceName: string): Promise<string | undefined> {
        const spaceRepository = new SpaceRepository(client);
        const spaceList = await spaceRepository.list({ partialName: spaceName });
        const matches = spaceList.Items.filter((s) => s.Name.localeCompare(spaceName) === 0);
        return matches.length > 0 ? matches[0].Id : undefined;
    }

    getContext(result: WaitExecutionResult): string {
        return result.tenantName ? result.tenantName.replace(" ", "_") : result.environmentName.replace(" ", "_");
    }

    async waitWithoutProgress(client: Client, inputParameters: InputParameters): Promise<WaitExecutionResult[]> {
        const waiter = new ServerTaskWaiter(client, inputParameters.space);
        const taskIds = inputParameters.tasks.map((t) => t.serverTaskId);
        const lookup = new Map(inputParameters.tasks.map((t) => [t.serverTaskId, t]));

        const results: WaitExecutionResult[] = [];

        await waiter.waitForServerTasksToComplete(taskIds, inputParameters.pollingInterval * 1000, inputParameters.timeout * 1000, (t) => {
            const taskResult = lookup.get(t.Id);
            if (!taskResult) return;
            const context = this.getProgressContext(taskResult);

            if (!t.IsCompleted) {
                this.logger.info?.(`${taskResult.type}${context} is '${t.State}'`);
                return;
            }

            this.logger.info?.(`${taskResult.type}${context} ${t.State === TaskState.Success ? "completed successfully" : "did not complete successfully"}`);
            taskResult.successful = t.State == TaskState.Success;
            results.push(taskResult);
        });
        return results;
    }

    async waitWithProgress(client: Client, inputParameters: InputParameters): Promise<WaitExecutionResult[]> {
        const waiter = new ServerTaskWaiter(client, inputParameters.space);
        const taskIds = inputParameters.tasks.map((t) => t.serverTaskId);
        const taskLookup = new Map(inputParameters.tasks.map((t) => [t.serverTaskId, t]));

        const taskRepository = new SpaceServerTaskRepository(client, inputParameters.space);
        const loggedChildTaskIds: string[] = [];
        const lastTaskUpdate: { [taskId: string]: string } = {};

        const results: WaitExecutionResult[] = [];

        const promises: Promise<void>[] = [];
        await waiter.waitForServerTasksToComplete(taskIds, inputParameters.pollingInterval * 1000, inputParameters.timeout * 1000, (t) => {
            const taskResult = taskLookup.get(t.Id);
            if (!taskResult) return;

            const taskUpdate = `${taskResult.type}${this.getProgressContext(taskResult)} is '${t.State}'`;
            if (loggedChildTaskIds.length == 0 && lastTaskUpdate[taskResult.serverTaskId] !== taskUpdate) {
                // Log top level updates until we have details, don't log them again
                this.logger.info?.(taskUpdate);
                lastTaskUpdate[taskResult.serverTaskId] = taskUpdate;
            }

            // Log details of the task
            const promise = this.printTaskDetails(taskRepository, taskResult, loggedChildTaskIds, results);
            promises.push(promise);
        });

        await Promise.all(promises);
        return results;
    }

    async printTaskDetails(repository: SpaceServerTaskRepository, task: WaitExecutionResult, loggedChildTaskIds: string[], results: WaitExecutionResult[]): Promise<void> {
        try {
            this.logger.debug?.(`Fetching details on ${task.serverTaskId}`);
            const taskDetails = await repository.getDetails(task.serverTaskId);
            this.logger.debug?.(`Fetched details on ${task.serverTaskId}: ${JSON.stringify(taskDetails)}`);

            const activities = taskDetails.ActivityLogs.flatMap((parentActivity) => parentActivity.Children.filter(isComplete).filter((activity) => !loggedChildTaskIds.includes(activity.Id)));

            for (const activity of activities) {
                this.logWithStatus(`\t${activity.Status}: ${activity.Name}`, activity.Status);

                if (activity.Started && activity.Ended) {
                    const startTime = new Date(activity.Started);
                    const endTime = new Date(activity.Ended);
                    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
                    this.logger.info?.(`\t\t\t---------------------------------`);
                    this.logger.info?.(`\t\t\tStarted: \t${activity.Started}\n\t\t\tEnded:   \t${activity.Ended}\n\t\t\tDuration:\t${duration.toFixed(1)}s`);
                    this.logger.info?.(`\t\t\t---------------------------------`);
                }

                activity.Children.filter(isComplete)
                    .flatMap((child) => child.LogElements)
                    .forEach((log) => {
                        this.logWithCategory(`\t\t${log.OccurredAt}: ${log.MessageText}`, log.Category);
                        log.Detail && this.logger.debug?.(log.Detail);
                    });

                loggedChildTaskIds.push(activity.Id);
            }
            if (!taskDetails.Task.IsCompleted) return;

            const message = taskDetails.Task.State === TaskState.Success ? "completed successfully" : "did not complete successfully";
            this.logger.info?.(`${task.type}${this.getProgressContext(task)} ${message}`);
            task.successful = taskDetails.Task.State === TaskState.Success;
            results.push(task);
        } catch (e) {
            const error = e instanceof Error ? e : undefined;
            this.logger.error?.(`Failed to fetch details on ${task}: ${e}`, error);
        }
    }

    getProgressContext(task: WaitExecutionResult): string {
        return `${task.environmentName ? ` to environment '${task.environmentName}'` : ""}${task.tenantName ? ` for tenant '${task.tenantName}'` : ""}`;
    }

    logWithCategory(message: string, category?: ActivityLogEntryCategory) {
        switch (category) {
            case "Error":
            case "Fatal":
                this.logger.error?.(message, undefined);
                break;
            case "Warning":
                this.logger.warn?.(message);
                break;
            default:
                this.logger.info?.(message);
        }
    }

    logWithStatus(message: string, status?: ActivityStatus) {
        switch (status) {
            case "Failed":
                this.logger.error?.(message, undefined);
                break;
            case "SuccessWithWarning":
                this.logger.warn?.(message);
                break;
            default:
                this.logger.info?.(message);
        }
    }
}

function isComplete(element: ActivityElement) {
    return element.Status != "Pending" && element.Status != "Running";
}
