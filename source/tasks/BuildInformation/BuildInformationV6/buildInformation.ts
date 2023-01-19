import { OctoServerConnectionDetails } from "../../Utils/connection";
import { getInputCommand } from "./inputParameters";
import { BuildInformationRepository, Client, ClientConfiguration, Logger } from "@octopusdeploy/api-client";
import { TaskWrapper } from "tasks/Utils/taskInput";
import { getOverwriteMode } from "./overwriteMode";
import { IVstsHelper } from "./vsts";

export class BuildInformation {
    constructor(readonly connection: OctoServerConnectionDetails, readonly logger: Logger, readonly task: TaskWrapper, readonly vsts: IVstsHelper) {}

    public async run() {
        const command = await getInputCommand(this.logger, this.task, this.vsts);

        const config: ClientConfiguration = {
            userAgentApp: "AzureDevOps (build-information;push;v6)",
            instanceURL: this.connection.url,
            apiKey: this.connection.apiKey,
            logging: this.logger,
        };
        const client = await Client.create(config);

        const overwriteMode = await getOverwriteMode(this.logger, this.task);
        this.logger.debug?.(`Build Information:\n${JSON.stringify(command, null, 2)}`);
        const repository = new BuildInformationRepository(client, command.SpaceName);
        await repository.push(command, overwriteMode);
    }
}
