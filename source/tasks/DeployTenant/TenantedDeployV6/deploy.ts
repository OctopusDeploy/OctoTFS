import { CreateDeploymentTenantedCommandV1, Logger, Client, resolveSpaceId, EnvironmentRepository } from "@octopusdeploy/api-client";
import { OctoServerConnectionDetails } from "../../Utils/connection";
import { createDeploymentFromInputs } from "./createDeployment";
import { createCommandFromInputs } from "./inputCommandBuilder";
import os from "os";
import { TaskWrapper } from "tasks/Utils/taskInput";
import { getClient } from "../../Utils/client";
import { ExecutionResult } from "../../Utils/executionResult";

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
        const spaceId = await resolveSpaceId(client, command.spaceName);
        const environmentRepo = new EnvironmentRepository(client, command.spaceName);
        environmentRepo

    }
}
