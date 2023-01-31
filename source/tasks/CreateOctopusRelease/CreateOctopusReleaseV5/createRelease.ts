import { OctopusToolRunner } from "../../Utils/tool";
import { executeTask } from "../../Utils/octopusTasks";
import { OctoServerConnectionDetails } from "../../Utils/connection";

export class CreateRelease {
    constructor(readonly tool: OctopusToolRunner, readonly connection: OctoServerConnectionDetails) {}

    public async run(
        space: string,
        project: string,
        releaseNumber?: string | undefined,
        channel?: string | undefined,
        customReleaseNotes?: string | undefined,
        deployToEnvironments: string[] = [],
        deployForTenants: string[] = [],
        deployForTenantTags: string[] = [],
        deploymentProgress?: boolean | undefined,
        additionalArguments?: string | undefined,
        gitRef?: string | undefined,
        gitCommit?: string | undefined
    ) {
        this.tool.arg("create-release");
        this.tool.arg(["--space", space]);
        this.tool.arg(["--project", project]);
        this.tool.argIf(releaseNumber, ["--releaseNumber", `${releaseNumber}`]);
        this.tool.argIf(channel, ["--channel", `${channel}`]);
        this.tool.argIf(gitCommit, ["--gitCommit", `${gitCommit}`]);
        this.tool.argIf(gitRef, ["--gitRef", `${gitRef}`]);
        this.tool.argIf(customReleaseNotes, ["--releaseNotes", `${customReleaseNotes}`]);
        this.tool.arg("--enableServiceMessages");
        this.tool.argIf(deploymentProgress, "--progress");
        for (const item of deployToEnvironments) {
            this.tool.arg(["--deployTo", item]);
        }
        for (const item of deployForTenants) {
            this.tool.arg(["--tenant", item]);
        }
        for (const item of deployForTenantTags) {
            this.tool.arg(["--tenantTag", item]);
        }

        await executeTask(this.tool, "(release;create;v5)", this.connection, "Create release succeeded.", "Failed to create release.", additionalArguments);
    }
}
