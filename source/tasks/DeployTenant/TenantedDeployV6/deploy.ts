import { Logger } from "@octopusdeploy/api-client";
import { OctoServerConnectionDetails } from "../../Utils/connection";
import { createDeploymentFromInputs } from "./createDeployment";
import { createCommandFromInputs } from "./inputCommandBuilder";
import os from "os";
import { TaskWrapper } from "tasks/Utils/taskInput";
import { getClient } from "../../Utils/client";

export class Deploy {
    constructor(readonly connection: OctoServerConnectionDetails, readonly task: TaskWrapper, readonly logger: Logger) {}

    public async run() {
        try {
            const command = createCommandFromInputs(this.logger, this.task);
            const client = await getClient(this.connection, this.logger, "release", "deploy-tenanted", 6);

            createDeploymentFromInputs(client, command, this.task, this.logger);

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
}
