import { Logger } from "@octopusdeploy/api-client";
import { OctoServerConnectionDetails } from "../../Utils/connection";
import { createRunbookRunFromInputs } from "./runRunbook";
import { createCommandFromInputs } from "./inputCommandBuilder";
import os from "os";
import { TaskWrapper } from "tasks/Utils/taskInput";
import { getClient } from "../../Utils/client";

export class RunbookRun {
    constructor(readonly connection: OctoServerConnectionDetails, readonly task: TaskWrapper, readonly logger: Logger) {}

    public async run() {
        try {
            const command = createCommandFromInputs(this.logger, this.task);
            const client = await getClient(this.connection, this.logger, "runbook", "run", 6);

            createRunbookRunFromInputs(client, command, this.task, this.logger);

            this.task.setSuccess("Runbook run succeeded.");
        } catch (error: unknown) {
            if (error instanceof Error) {
                this.task.setFailure(`"Failed to successfully run runbook. ${error.message}${os.EOL}${error.stack}`, true);
            } else {
                this.task.setFailure(`"Failed to successfully run runbook. ${error}`, true);
            }
            throw error;
        }
    }
}
