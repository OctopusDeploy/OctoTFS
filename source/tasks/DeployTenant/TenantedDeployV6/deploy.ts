import { CreateDeploymentTenantedCommandV1, Logger, Client, resolveSpaceId, SpaceServerTaskRepository, ServerTask } from "@octopusdeploy/api-client";
import { OctoServerConnectionDetails } from "../../Utils/connection";
import { createDeploymentFromInputs } from "./createDeployment";
import { createCommandFromInputs } from "./inputCommandBuilder";
import os from "os";
import { TaskWrapper } from "tasks/Utils/taskInput";
import { getClient } from "../../Utils/client";
import { ExecutionResult } from "../../Utils/executionResult";
import path from "path";
import { getVstsEnvironmentVariables } from "../../../tasksLegacy/Utils/environment";
import { v4 as uuidv4 } from "uuid";
import * as tasks from "azure-pipelines-task-lib";

export class Deploy {
    constructor(readonly connection: OctoServerConnectionDetails, readonly task: TaskWrapper, readonly logger: Logger) {}

    public async run() {
        try {
            const command = createCommandFromInputs(this.logger, this.task);
            const client = await getClient(this.connection, this.logger, "release", "deploy-tenanted", 6);

            const results = await createDeploymentFromInputs(client, command, this.task, this.logger);

            await this.tryCreateSummary(client, command, results);

            this.task.setSuccess("Deployment succeeded.");
        } catch (error: unknown) {
            if (error instanceof Error) {
                this.task.setFailure(`"Failed to successfully deploy release. ${error.message}${os.EOL}${error.stack}`, true);
            } else {
                this.task.setFailure(`"Failed to successfully deploy release. ${error}`, true);
            }
            throw error;
        }
    }

    private async tryCreateSummary(client: Client, command: CreateDeploymentTenantedCommandV1, results: ExecutionResult[]) {
        if (results.length === 0) {
            return;
        }

        const spaceId = await resolveSpaceId(client, command.spaceName);
        const taskRepo = new SpaceServerTaskRepository(client, command.spaceName);
        const allTasks = await taskRepo.getByIds<{ DeploymentId: string }>(results.map((t) => t.serverTaskId));
        const taskLookup = new Map<string, ServerTask<{ DeploymentId: string }>>();
        allTasks.forEach(function (t) {
            taskLookup.set(t.Id, t);
        });

        const url = this.connection.url;
        let markdown = `${results[0].type} tasks for '${results[0].environmentName}' environment\n\n`;
        results.forEach(function (result) {
            const task = taskLookup.get(result.serverTaskId);
            if (task != null) {
                const link = `${url}app#/${spaceId}/deployments/${task.Arguments.DeploymentId}`;
                markdown += `[${result.tenantName}](${link})\n`;
            }
        });

        const markdownFile = path.join(getVstsEnvironmentVariables().defaultWorkingDirectory, `${uuidv4()}.md`);
        tasks.writeFile(markdownFile, markdown);
        tasks.addAttachment("Distributedtask.Core.Summary", "Octopus Deploy Tenants", markdownFile);
    }
}
