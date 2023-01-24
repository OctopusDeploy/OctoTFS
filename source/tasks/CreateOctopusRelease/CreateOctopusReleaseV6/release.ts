import { Client, ClientConfiguration, Logger } from "@octopusdeploy/api-client";
import { OctoServerConnectionDetails } from "../../Utils/connection";
import { createReleaseFromInputs } from "./createRelease";
import { createCommandFromInputs } from "./inputCommandBuilder";
import os from "os";
import { TaskWrapper } from "tasks/Utils/taskInput";
import { getUserAgentApp } from "../../Utils/pluginInformation";

export class Release {
    constructor(readonly connection: OctoServerConnectionDetails, readonly task: TaskWrapper, readonly logger: Logger) {}

    public async run() {
        try {
            const command = createCommandFromInputs(this.logger, this.task);

            const config: ClientConfiguration = {
                userAgentApp: getUserAgentApp("release", "create", 6),
                instanceURL: this.connection.url,
                apiKey: this.connection.apiKey,
                logging: this.logger,
            };
            const client = await Client.create(config);

            await createReleaseFromInputs(client, command, this.task, this.logger);

            this.task.setSuccess("Release creation succeeded.");
        } catch (error: unknown) {
            if (error instanceof Error) {
                this.task.setFailure(`"Failed to successfully create release. ${error.message}${os.EOL}${error.stack}`, true);
            } else {
                this.task.setFailure(`"Failed to successfully create release. ${error}`, true);
            }
            throw error;
        }
    }
}
