import { OctopusToolRunner } from "../../Utils/tool";
import { OctoServerConnectionDetails } from "../../Utils/connection";
import { executeTask } from "../../Utils/octopusTasks";

export class Deploy {
    constructor(readonly tool: OctopusToolRunner, readonly connection: OctoServerConnectionDetails) {}

    public async run(
        space: string,
        project: string,
        releaseNumber: string,
        deployToEnvironments: string[],
        deployForTenants: string[] = [],
        deployForTenantTags: string[] = [],
        showProgress?: boolean | undefined,
        additionalArguments?: string | undefined
    ) {
        this.tool.arg("deploy-release");
        this.tool.arg(["--space", `"${space}"`]);
        this.tool.arg(["--project", `"${project}"`]);
        this.tool.argIf(releaseNumber, ["--releaseNumber", `"${releaseNumber}"`]);
        this.tool.arg("--enableServiceMessages");
        this.tool.argIf(showProgress, "--progress");
        for (const item of deployToEnvironments) {
            this.tool.arg(["--deployTo", `"${item}"`]);
        }
        for (const item of deployForTenants) {
            this.tool.arg(["--tenant", `"${item}"`]);
        }
        for (const item of deployForTenantTags) {
            this.tool.arg(["--tenantTag", `"${item}"`]);
        }

        await executeTask(this.tool, this.connection, "Deployment succeeded.", "Failed to deploy release.", additionalArguments);
    }
}
