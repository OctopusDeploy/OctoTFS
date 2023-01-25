import { Client, ClientConfiguration, Logger, ServerTaskWaiter, SpaceRepository, TaskState } from "@octopusdeploy/api-client";
import { OctoServerConnectionDetails } from "tasks/Utils/connection";
import { TaskWrapper } from "tasks/Utils/taskInput";
import { getUserAgentApp } from "../../Utils/pluginInformation";
import { getInputParameters } from "./input-parameters";
import { ExecutionResult } from "../../Utils/executionResult";

export interface WaitExecutionResult extends ExecutionResult {
    successful: boolean;
}

export class Waiter {
    constructor(readonly connection: OctoServerConnectionDetails, readonly task: TaskWrapper, readonly logger: Logger) {}

    public async run() {
        const inputParameters = getInputParameters(this.logger, this.task);

        const config: ClientConfiguration = {
            userAgentApp: getUserAgentApp("task", "wait", 6),
            instanceURL: this.connection.url,
            apiKey: this.connection.apiKey,
            logging: this.logger,
        };
        const client = await Client.create(config);

        const waiter = new ServerTaskWaiter(client, inputParameters.space);

        const taskIds: string[] = [];
        const waitExecutionResults: WaitExecutionResult[] = [];
        const lookup: Map<string, WaitExecutionResult> = new Map<string, WaitExecutionResult>();
        inputParameters.tasks.map((t) => {
            lookup.set(t.serverTaskId, t);
            taskIds.push(t.serverTaskId);
        });

        await waiter.waitForServerTasksToComplete(taskIds, inputParameters.pollingInterval * 1000, inputParameters.timeout * 1000, (t) => {
            let context = "";
            const taskResult = lookup.get(t.Id);
            if (taskResult) {
                if (taskResult?.environmentName) {
                    context = ` to environment '${taskResult.environmentName}'`;
                }
                if (taskResult?.tenantName) {
                    context += ` for tenant '${taskResult?.tenantName}'`;
                }

                if (t.IsCompleted) {
                    this.logger.info?.(`${taskResult.type}${context} ${t.State === TaskState.Success ? "completed successfully" : "did not complete successfully"}`);
                } else {
                    this.logger.info?.(`${taskResult.type}${context} is '${t.State}'`);
                }

                if (t.IsCompleted) {
                    taskResult.successful = t.IsCompleted && t.State == TaskState.Success;
                    waitExecutionResults.push(taskResult);
                }
            }
        });

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
}
