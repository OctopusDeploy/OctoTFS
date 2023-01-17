import { OctoServerConnectionDetails } from "../../Utils/connection";
import { executeTask } from "../../Utils/octopusTasks";
import { OctopusToolRunner } from "../../Utils/tool";

export class Promote {
    constructor(readonly tool: OctopusToolRunner, readonly connection: OctoServerConnectionDetails) {}

    public async run(space: string, project: string, from: string, to: string[], deployForTenants: string[] = [], deployForTenantTags: string[] = [], showProgress?: boolean | undefined, additionalArguments?: string | undefined) {
        this.tool.arg("promote-release");
        this.tool.arg(["--space", space]);
        this.tool.arg(["--project", project]);
        this.tool.arg(["--from", from]);
        this.tool.arg("--enableServiceMessages");
        this.tool.argIf(showProgress, "--progress");
        for (const item of to) {
            this.tool.arg(["--to", item]);
        }
        for (const item of deployForTenants) {
            this.tool.arg(["--tenant", item]);
        }
        for (const item of deployForTenantTags) {
            this.tool.arg(["--tenantTag", item]);
        }

        await executeTask(this.tool, "(release;promote;v5)", this.connection, "Promote release succeeded.", "Failed to promote release.", additionalArguments);
    }
}
