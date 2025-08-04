import { OctoServerConnectionDetails } from "../../Utils/connection";
import { createCommandFromInputs } from "./inputCommandBuilder";
import { BuildInformationRepository, Logger } from "@octopusdeploy/api-client";
import { TaskWrapper } from "tasks/Utils/taskInput";
import { getOverwriteMode } from "./overwriteMode";
import { IVstsHelper } from "./vsts";
import { getClient } from "../../Utils/client";

export class BuildInformation {
    constructor(readonly connection: OctoServerConnectionDetails, readonly logger: Logger, readonly task: TaskWrapper, readonly vsts: IVstsHelper) {}

    public async run() {
        const command = await createCommandFromInputs(this.logger, this.task, this.vsts);
        const client = await getClient(this.connection, this.logger, "build-information", "push", 6)

        const overwriteMode = await getOverwriteMode(this.logger, this.task);
        this.logger.debug?.(`Build Information:\n${JSON.stringify(command, null, 2)}`);
        const repository = new BuildInformationRepository(client, command.spaceName);
        await repository.push(command, overwriteMode);
    }
}
