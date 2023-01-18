import * as tasks from "azure-pipelines-task-lib/task";
import * as path from "path";
import os from "os";
import { OctoServerConnectionDetails } from "../../Utils/connection";
import * as vsts from "azure-devops-node-api";
import { WebApi } from "azure-devops-node-api";
import { getInputParameters } from "./inputParameters";
import { BuildInformationRepository, Client, ClientConfiguration, CreateOctopusBuildInformationCommand, Logger, PackageIdentity } from "@octopusdeploy/api-client";
import { TaskWrapper } from "tasks/Utils/taskInput";

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
    constructor(readonly connection: OctoServerConnectionDetails, readonly logger: Logger, readonly task: TaskWrapper) {}

    public async run() {
        const environment = this.getVstsEnvironmentVariables();
        const vstsConnection = this.createVstsConnection(environment);

        const branch = await this.getBuildBranch(vstsConnection, environment);

        const inputParameters = getInputParameters(parseInt(this.task.getVariable("system.jobAttempt") || "0") > 1, this.logger, this.task);

        const config: ClientConfiguration = {
            userAgentApp: "AzureDevOps (push-build-information;v6)",
            instanceURL: this.connection.url,
            apiKey: this.connection.apiKey,
            logging: this.logger,
        };
        const client = await Client.create(config);

        const commits = await this.getBuildChanges(vstsConnection, environment);

        const packages: PackageIdentity[] = [];
        for (const packageId of inputParameters.packages) {
            packages.push({
                Id: packageId,
                Version: inputParameters.version,
            });
        }

        const command: CreateOctopusBuildInformationCommand = {
            spaceName: inputParameters.space,
            BuildEnvironment: "Azure DevOps",
            BuildNumber: environment.buildNumber,
            BuildUrl: environment.teamCollectionUri.replace(/\/$/, "") + "/" + environment.projectName + "/_build/results?buildId=" + environment.buildId,
            Branch: branch || "",
            VcsType: this.getVcsTypeFromProvider(environment.buildRepositoryProvider),
            VcsRoot: environment.buildRepositoryUri,
            VcsCommitNumber: environment.buildSourceVersion,
            Commits: commits.map((change) => ({ Id: change.id || "", Comment: change.message || "" })),
            Packages: packages,
        };

        if (!environment.agentBuildDirectory) {
            tasks.error("The Build Information step requires build information and therefore is not compatible with use in a Release pipeline.");
            return;
        }

        const buildInformationDir = path.join(environment.agentBuildDirectory, "octo");
        const buildInformationFile = path.join(buildInformationDir, `${environment.buildId}-buildinformation.json`);
        await tasks.mkdirP(buildInformationDir);
        await tasks.writeFile(buildInformationFile, JSON.stringify(command, null, 2));

        this.logger.debug?.(`Build Information:\n${JSON.stringify(command, null, 2)}`);
        const repository = new BuildInformationRepository(client, inputParameters.space);
        await repository.push(command, inputParameters.overwriteMode);
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

    private getBuildBranch = async (client: WebApi, environment: VstsEnvironmentVariables) => {
        const api = await client.getBuildApi();
        return (await api.getBuild(environment.projectName, environment.buildId)).sourceBranch;
    };
}
