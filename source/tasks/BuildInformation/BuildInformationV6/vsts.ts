import { IOctopusBuildInformationCommit, Logger } from "@octopusdeploy/api-client";
import * as vsts from "azure-devops-node-api";
import * as tasks from "azure-pipelines-task-lib/task";
import os from "os";

export interface VstsParameters {
    branch: string;
    environment: VstsEnvironmentVariables;
    vcsType: string;
    commits: IOctopusBuildInformationCommit[];
}

export interface IVstsHelper {
    getVsts(logger: Logger): Promise<VstsParameters>;
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

export class VstsHelper implements IVstsHelper {
    constructor(readonly logger: Logger) {}
    async getVsts(): Promise<VstsParameters> {
        const environment = this.getVstsEnvironmentVariables();
        const vstsConnection = this.createVstsConnection(environment);
        const branch = await this.getBuildBranch(vstsConnection, environment);
        const commits = await this.getBuildChanges(vstsConnection, environment, this.logger);

        const vsts: VstsParameters = {
            branch: branch || "",
            environment: environment,
            vcsType: await this.getVcsTypeFromProvider(environment.buildRepositoryProvider),
            commits: commits,
        };

        return vsts;
    }

    private getVstsEnvironmentVariables(): VstsEnvironmentVariables {
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
    }

    private getVcsTypeFromProvider(buildRepositoryProvider: string): string {
        switch (buildRepositoryProvider) {
            case "TfsGit":
            case "GitHub":
                return "Git";
            case "TfsVersionControl":
                return "TFVC";
            default:
                return buildRepositoryProvider;
        }
    }

    private createVstsConnection(environment: SystemEnvironmentVariables): vsts.WebApi {
        const vstsAuthorization = tasks.getEndpointAuthorization("SystemVssConnection", true);
        const token = vstsAuthorization?.parameters["AccessToken"] || "";
        const authHandler = vsts.getPersonalAccessTokenHandler(token);
        return new vsts.WebApi(environment.teamCollectionUri, authHandler);
    }

    private async getBuildBranch(client: vsts.WebApi, environment: VstsEnvironmentVariables): Promise<string | undefined> {
        const api = await client.getBuildApi();
        const build = await api.getBuild(environment.projectName, environment.buildId);
        return build.sourceBranch;
    }

    private async getBuildChanges(client: vsts.WebApi, environment: VstsEnvironmentVariables, logger: Logger): Promise<IOctopusBuildInformationCommit[]> {
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
                                logger.warn?.(`Using a truncated commit message for commit ${x.id}, because an error occurred while fetching the full message.${os.EOL}${error.message}`);
                            }
                        }
                    }
                }

                return x;
            });

            await Promise.all(promises);
        }

        return changes.map((change) => ({ Id: change.id || "", Comment: change.message || "" }));
    }
}
