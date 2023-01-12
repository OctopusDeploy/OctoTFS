import { Client, ClientConfiguration, Logger } from "@octopusdeploy/api-client";
import { OctoServerConnectionDetails } from "../../Utils/connection";
import { createDeploymentFromInputs } from "./createDeployment";
import { getInputParameters } from "./input-parameters";
import os from "os";
import { TaskWrapper } from "tasks/Utils/taskInput";

export class Deploy {
    constructor(readonly connection: OctoServerConnectionDetails, readonly task: TaskWrapper, readonly logger: Logger) {}

    public async run() {
        try {
            const inputParameters = getInputParameters(this.logger, this.task);

            const config: ClientConfiguration = {
                userAgentApp: "AzureDevOps deploy-release",
                instanceURL: this.connection.url,
                apiKey: this.connection.apiKey,
                logging: this.logger,
            };
            const client = await Client.create(config);

            createDeploymentFromInputs(client, inputParameters, this.task, this.logger);

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
