import * as path from "path";
const uuidv1 = require("uuid/v1");
import * as vsts from "azure-devops-node-api/WebApi";
import * as wit from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces";
import * as bi from "azure-devops-node-api/interfaces/BuildInterfaces";
import * as tasks from "azure-pipelines-task-lib";
import { isNullOrWhitespace } from "./inputs";

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

export const getVstsEnvironmentVariables = (): VstsEnvironmentVariables => {
    return {
        projectId: process.env["SYSTEM_TEAMPROJECTID"],
        projectName: process.env["SYSTEM_TEAMPROJECT"],
        buildNumber: process.env["BUILD_BUILDNUMBER"],
        buildId: Number(process.env["BUILD_BUILDID"]),
        buildName: process.env["BUILD_DEFINITIONNAME"],
        buildRepositoryName: process.env["BUILD_REPOSITORY_NAME"],
        releaseName: process.env["RELEASE_RELEASENAME"],
        releaseUri: process.env["RELEASE_RELEASEWEBURL"],
        releaseId: process.env["RELEASE_RELEASEID"],
        teamCollectionUri: process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"],
        defaultWorkingDirectory: process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"],
        buildRepositoryProvider: process.env["BUILD_REPOSITORY_PROVIDER"],
        buildRepositoryUri: process.env["BUILD_REPOSITORY_URI"],
        buildSourceVersion: process.env["BUILD_SOURCEVERSION"],
        agentBuildDirectory: process.env["AGENT_BUILDDIRECTORY"],
    };
};

export const generateReleaseNotesContent = (environment: VstsEnvironmentVariables, linkedItemReleaseNote: string, customReleaseNotes: string) => {
    let notes: string = "Release created by ";
    const buildUri = `${environment.teamCollectionUri}${encodeURIComponent(environment.projectName)}/_build/index?_a=summary&buildId=${environment.buildId}`;

    if (!isNullOrWhitespace(environment.releaseId)) {
        notes += `Release Management Release [${environment.releaseName} #${environment.releaseId}](${environment.releaseUri}) `;
    }

    if (environment.buildId) {
        notes += `Build [${environment.buildName} #${environment.buildNumber}](${buildUri}) from the ${environment.buildRepositoryName} repository `;
    }

    notes += `in Team Project ${environment.projectName}`;
    if (!isNullOrWhitespace(linkedItemReleaseNote)) {
        notes += `\r\n\r\n${linkedItemReleaseNote}`;
    }

    if (!isNullOrWhitespace(customReleaseNotes)) {
        notes += `\r\n\r\n**Custom Notes:**`;
        notes += `\r\n\r\n${customReleaseNotes}`;
    }

    return notes;
};

export const createReleaseNotesFile = (content: () => string, directory: string): string => {
    const filePath = path.join(directory, `release-notes-${uuidv1()}.md`);
    tasks.writeFile(filePath, content(), { encoding: "utf8" });
    return filePath;
};

export const getWorkItemState = (workItem: wit.WorkItem) => {
    return `<span class='label'>${workItem && workItem.fields ? workItem.fields["System.State"] : ""}</span>`;
};

export const getWorkItemTags = (workItem: wit.WorkItem) => {
    if (workItem && workItem.fields && !isNullOrWhitespace(workItem.fields["System.Tags"])) {
        const tags = workItem.fields["System.Tags"].split(";");
        return tags.reduce((prev: string, current: string) => {
            return (prev += `<span class='label label-info'>${current}</span>`);
        }, "");
    }

    return "";
};

export const getLinkedReleaseNotes = async (client: vsts.WebApi, includeComments: boolean, includeWorkItems: boolean) => {
    const environment = getVstsEnvironmentVariables();
    console.log(`Environment = ${environment.buildRepositoryProvider}`);
    console.log(`Comments = ${includeComments}, WorkItems = ${includeWorkItems}`);

    try {
        const changes = await client.getBuildApi().then((x) => x.getBuildChanges(environment.projectName, environment.buildId));

        let releaseNotes = "";
        let newLine = "\r\n\r\n";

        if (includeComments) {
            if (environment.buildRepositoryProvider === "TfsVersionControl") {
                console.log("Adding changeset comments to release notes");
                releaseNotes += changes.reduce((prev, current) => {
                    return prev + `* [${current.id} - ${current.author.displayName}](${getChangesetUrl(environment, current.location)}): ${current.message}${newLine}`;
                }, `**Changeset Comments:**${newLine}`);
            } else if (environment.buildRepositoryProvider === "TfsGit") {
                /*
                    TfsGit repo has a known URL that individual commits can be linked to,
                    so the release notes have markdown URLs
                 */
                console.log("Adding commit message to release notes");
                releaseNotes += changes.reduce((prev, current) => {
                    return prev + `* [${current.id} - ${current.author.displayName}](${getCommitUrl(environment, current)}): ${current.message}${newLine}`;
                }, `**Commit Messages:**${newLine}`);
            } else {
                /*
                    This could be any other git repo like Git, GitHub, SVN etc. We don't know
                    how to link to the commits here, so leave out the URLs.
                 */
                console.log("Adding commit message to release notes");
                releaseNotes += changes.reduce((prev, current) => {
                    return prev + `* ${current.id} - ${current.author.displayName}: ${current.message}${newLine}`;
                }, `**Commit Messages:**${newLine}`);
            }
        }

        if (includeWorkItems) {
            console.log("adding work items to release notes");
            releaseNotes += `**Work Items:**${newLine}`;

            const workItemRefs = await client.getBuildApi().then((x) => x.getBuildWorkItemsRefs(environment.projectName, environment.buildId));

            if (workItemRefs.length > 0) {
                var workItems = await client.getWorkItemTrackingApi().then((x) => x.getWorkItems(workItemRefs.map((x) => Number(x.id))));

                let workItemEditBaseUri = `${environment.teamCollectionUri}${environment.projectId}/_workitems/edit`;
                releaseNotes += workItems.reduce((prev, current) => {
                    return (prev += `* [${current.id}](${workItemEditBaseUri}/${current.id}): ${current.fields["System.Title"]} ${getWorkItemState(current)} ${getWorkItemTags(current)} ${newLine}`);
                }, "");
            }
        }

        console.log(`Release notes:\r\n${releaseNotes}`);
        return releaseNotes;
    } catch (ex) {
        console.log("An exception was thrown while building the release notes.");
        console.log(ex);
        console.log("See https://github.com/OctopusDeploy/OctoTFS/issues/107 for more details.");
        console.log("The release notes will be empty.");
        return "";
    }
};

const getChangesetUrl = (environment: VstsEnvironmentVariables, apiUrl: string) => {
    let workItemId = apiUrl.substr(apiUrl.lastIndexOf("/") + 1);
    return `${environment.teamCollectionUri}${environment.projectId}/_versionControl/changeset/${workItemId}`;
};

const getCommitUrl = (environment: VstsEnvironmentVariables, change: bi.Change) => {
    let commitId = change.id;
    const segments = change.location.split("/");
    const repositoryId = segments[segments.length - 3];
    return `${environment.teamCollectionUri}${environment.projectId}/_git/${repositoryId}/commit/${commitId}`;
};

export const createVstsConnection = (environment: SystemEnvironmentVariables) => {
    var vstsAuthorization = tasks.getEndpointAuthorization("SystemVssConnection", true);
    var token = vstsAuthorization.parameters["AccessToken"];
    let authHandler = vsts.getPersonalAccessTokenHandler(token);
    return new vsts.WebApi(environment.teamCollectionUri, authHandler);
};

export const getVcsTypeFromProvider = (buildRepositoryProvider: string) => {
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

export const getBuildBranch = async (client: vsts.WebApi) => {
    const environment = getVstsEnvironmentVariables();
    const api = await client.getBuildApi();
    return (await api.getBuild(environment.buildId, environment.projectName)).sourceBranch;
};

export const getBuildChanges = async (client: vsts.WebApi) => {
    const environment = getVstsEnvironmentVariables();
    const api = await client.getBuildApi();
    const gitApi = await client.getGitApi();

    const changes = await api.getBuildChanges(environment.projectName, environment.buildId);

    if (environment.buildRepositoryProvider === "TfsGit") {
        let promises = changes.map(async (x) => {
            if (x.messageTruncated) {
                const segments = x.location.split("/");
                const repositoryId = segments[segments.length - 3];

                try {
                    const commit = await gitApi.getCommit(x.id, repositoryId);
                    x.message = commit.comment;
                } catch (err) {
                    tasks.warning(`Using a truncated commit message for commit ${x.id}, because an error occurred while fetching the full message. ${err}`);
                }
            }

            return x;
        });

        await Promise.all(promises);
    }

    return changes;
};
