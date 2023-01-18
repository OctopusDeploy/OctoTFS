import { Client, ClientConfiguration, Logger, ServerTaskWaiter, TaskState } from "@octopusdeploy/api-client";
import { OctoServerConnectionDetails } from "tasks/Utils/connection";
import { TaskWrapper } from "tasks/Utils/taskInput";
import { getInputParameters } from "./input-parameters";

export interface DeploymentResult {
    serverTaskId: string;
    tenantName: string;
    environmentName: string;
}

export class Waiter {
    constructor(readonly connection: OctoServerConnectionDetails, readonly task: TaskWrapper, readonly logger: Logger) {}

    public async run() {
        const inputParameters = getInputParameters(this.logger, this.task);

        const config: ClientConfiguration = {
            userAgentApp: "AzureDevOps (await-task;v6)",
            instanceURL: this.connection.url,
            apiKey: this.connection.apiKey,
            logging: this.logger,
        };
        const client = await Client.create(config);

        const waiter = new ServerTaskWaiter(client, inputParameters.space);

        const taskIds: string[] = [];
        const failedTaskIds: string[] = [];
        const lookup: Map<string, DeploymentResult> = new Map<string, DeploymentResult>();
        inputParameters.tasks.map((t) => {
            lookup.set(t.serverTaskId, t);
            taskIds.push(t.serverTaskId);
        });

        await waiter.waitForServerTasksToComplete(taskIds, inputParameters.pollingInterval * 1000, inputParameters.timeout * 1000, (t) => {
            let context = "";
            const deploymentResult = lookup.get(t.Id);
            if (deploymentResult?.environmentName) {
                context = ` to environment '${deploymentResult.environmentName}'`;
            }
            if (deploymentResult?.tenantName) {
                context += ` for tenant '${deploymentResult?.tenantName}'`;
            }

            if (t.IsCompleted) {
                this.logger.info?.(`Deployment${context} ${t.State === TaskState.Success ? "completed successfully" : "did not complete successfully"}`);
            } else {
                this.logger.info?.(`Deployment${context} is '${t.State}'`);
            }

            if (t.IsCompleted && t.State != TaskState.Success) {
                failedTaskIds.push(t.Id);
            }
        });

        if (failedTaskIds.length > 0) {
            this.task.setFailure(`${failedTaskIds.length} ${failedTaskIds.length === 1 ? "task" : "tasks"} failed.`);
        }
    }
}
