import * as tasks from "azure-pipelines-task-lib/task";
import * as path from "path";
import os from "os";
import { OctopusToolRunner } from "../../Utils/tool";
import { OctoServerConnectionDetails } from "../../Utils/connection";
import { ReplaceOverwriteMode } from "../../Utils/inputs";
import * as vsts from "azure-devops-node-api";
import { WebApi } from "azure-devops-node-api";
import { executeTask } from "../../Utils/octopusTasks";

export interface IOctopusBuildInformation {
    BuildEnvironment: string;
    BuildNumber: string;
    BuildUrl: string;
    Branch: string | undefined;
    VcsType: string;
    VcsRoot: string;
    VcsCommitNumber: string;
    Commits: IOctopusBuildInformationCommit[];
}

export interface IOctopusBuildInformationCommit {
    Id: string;
    Comment: string | undefined;
}

export interface ReleaseEnvironmentVariables {
    releaseName: string;
    releaseId: string;
    releaseUri: string;
}

export interface BuildEnvironmentVariables {
    buildNumber: string;
    buildId: number;
    buildName: string;
    buildRepositoryName: string;
    buildRepositoryProvider: string;
    buildRepositoryUri: string;
    buildSourceVersion: string;
}

export interface AgentEnvironmentVariables {
    agentBuildDirectory: string;
}

export interface SystemEnvironmentVariables {
    projectName: string;
    projectId: string;
    teamCollectionUri: string;
    defaultWorkingDirectory: string;
}

export type VstsEnvironmentVariables = ReleaseEnvironmentVariables & BuildEnvironmentVariables & AgentEnvironmentVariables & SystemEnvironmentVariables;

export class BuildInformation {
    constructor(readonly tool: OctopusToolRunner, readonly connection: OctoServerConnectionDetails) {}

    public async run(space: string, packageIds: string[], packageVersion: string, overwriteMode: ReplaceOverwriteMode, additionalArguments: string | undefined) {
        const environment = this.getVstsEnvironmentVariables();
        const vstsConnection = this.createVstsConnection(environment);

        const branch = await this.getBuildBranch(vstsConnection, environment);
        const commits = await this.getBuildChanges(vstsConnection, environment);

        const buildInformation: IOctopusBuildInformation = {
            BuildEnvironment: "Azure DevOps",
            BuildNumber: environment.buildNumber,
            BuildUrl: environment.teamCollectionUri.replace(/\/$/, "") + "/" + environment.projectName + "/_build/results?buildId=" + environment.buildId,
            Branch: branch,
            VcsType: this.getVcsTypeFromProvider(environment.buildRepositoryProvider),
            VcsRoot: environment.buildRepositoryUri,
            VcsCommitNumber: environment.buildSourceVersion,
            Commits: commits.map((change) => ({ Id: change.id || "", Comment: change.message })),
        };

        if (!environment.agentBuildDirectory) {
            tasks.error("The Build Information step requires build information and therefore is not compatible with use in a Release pipeline.");
            return;
        }

        const buildInformationDir = path.join(environment.agentBuildDirectory, "octo");
        const buildInformationFile = path.join(buildInformationDir, `${environment.buildId}-buildinformation.json`);
        await tasks.mkdirP(buildInformationDir);
        await tasks.writeFile(buildInformationFile, JSON.stringify(buildInformation, null, 2));

        this.tool.arg("build-information");
        this.tool.arg(["--space", space]);
        this.tool.arg(["--version", packageVersion]);
        this.tool.arg(["--file", buildInformationFile]);
        this.tool.arg(["--overwrite-mode", overwriteMode]);
        for (const item of packageIds) {
            this.tool.arg(["--package-id", item]);
        }

        await executeTask(this.tool, "(build-information;push;v5)", this.connection, "Build information successfully pushed.", "Failed to push build information.", additionalArguments);
    }

    private getVcsTypeFromProvider = (buildRepositoryProvider: string) => {
        switch (buildRepositoryProvider) {
            case "TfsGit":
            case "GitHub":
                return "Git";
            case "TfsVersionControl":
                return "TFVC";
            default:
                return buildRepositoryProvider;
        }
    };

    private getVstsEnvironmentVariables = (): VstsEnvironmentVariables => {
        return {
            projectId: process.env["SYSTEM_TEAMPROJECTID"] || "",
            projectName: process.env["SYSTEM_TEAMPROJECT"] || "",
            buildNumber: process.env["BUILD_BUILDNUMBER"] || "",
            buildId: Number(process.env["BUILD_BUILDID"]),
            buildName: process.env["BUILD_DEFINITIONNAME"] || "",
            buildRepositoryName: process.env["BUILD_REPOSITORY_NAME"] || "",
            releaseName: process.env["RELEASE_RELEASENAME"] || "",
            releaseUri: process.env["RELEASE_RELEASEWEBURL"] || "",
            releaseId: process.env["RELEASE_RELEASEID"] || "",
            teamCollectionUri: process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"] || "",
            defaultWorkingDirectory: process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] || "",
            buildRepositoryProvider: process.env["BUILD_REPOSITORY_PROVIDER"] || "",
            buildRepositoryUri: process.env["BUILD_REPOSITORY_URI"] || "",
            buildSourceVersion: process.env["BUILD_SOURCEVERSION"] || "",
            agentBuildDirectory: process.env["AGENT_BUILDDIRECTORY"] || "",
        };
    };

    private createVstsConnection = (environment: SystemEnvironmentVariables) => {
        const vstsAuthorization = tasks.getEndpointAuthorization("SystemVssConnection", true);
        const token = vstsAuthorization?.parameters["AccessToken"] || "";
        const authHandler = vsts.getPersonalAccessTokenHandler(token);
        return new vsts.WebApi(environment.teamCollectionUri, authHandler);
    };

    private getBuildBranch = async (client: WebApi, environment: VstsEnvironmentVariables) => {
        const api = await client.getBuildApi();
        return (await api.getBuild(environment.projectName, environment.buildId)).sourceBranch;
    };

    private getBuildChanges = async (client: vsts.WebApi, environment: VstsEnvironmentVariables) => {
        const api = await client.getBuildApi();
        const gitApi = await client.getGitApi();

        const changes = await api.getBuildChanges(environment.projectName, environment.buildId, undefined, 100000);

        if (environment.buildRepositoryProvider === "TfsGit") {
            const promises = changes.map(async (x) => {
                if (x.messageTruncated && x.id) {
                    const segments = x.location?.split("/");
                    if (segments && segments.length >= 3) {
                        const repositoryId = segments[segments.length - 3];

                        try {
                            const commit = await gitApi.getCommit(x.id, repositoryId);
                            x.message = commit.comment;
                        } catch (error: unknown) {
                            if (error instanceof Error) {
                                tasks.warning(`Using a truncated commit message for commit ${x.id}, because an error occurred while fetching the full message.${os.EOL}${error.message}`);
                            }
                        }
                    }
                }

                return x;
            });

            await Promise.all(promises);
        }

        return changes;
    };
}
