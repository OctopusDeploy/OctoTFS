import { OctoServerConnectionDetails } from "../../Utils/connection";
import { executeTask } from "../../Utils/octopusTasks";
import { OctopusToolRunner } from "../../Utils/tool";
import * as tasks from "azure-pipelines-task-lib";

export class OctoCli {
    constructor(readonly tool: OctopusToolRunner, readonly command: string, readonly connection: OctoServerConnectionDetails) {}

    public async run(args: string | undefined) {
        this.tool.arg(this.command);
        tasks.warning("This task is using a deprecated version of the Octopus CLI, we recommend using the latest version.");
        await executeTask(this.tool, "(cli;run;v5)", this.connection, "Succeeded executing octo command.", "Failed to execute octo command.", args);
    }
}
