import * as tasks from 'azure-pipelines-task-lib/task';
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';
import * as utils from "../Utils";
import * as path from "path";

import {
    connectionArguments,
    includeArguments,
    flag,
    argument,
    argumentEnquote,
    argumentIfSet
} from '../Utils/tool';

export interface IOctopusPackageMetadata {
    BuildEnvironment: string;
    CommentParser: string;
    BuildNumber: string;
    BuildUrl: string;
    VcsType: string;
    VcsRoot: string;
    VcsCommitNumber: string;
    Commits: IOctopusMetadataCommit[];
}

export interface IOctopusMetadataCommit {
    Id: string;
    Comment: string;
}

async function run() {
    try {
        const environment = utils.getVstsEnvironmentVariables();
        const vstsConnection = utils.createVstsConnection(environment);

        const hasSpaces = tasks.getBoolInput("HasSpaces", true);
        const spaceName = tasks.getInput("SpaceName");
        const packageId = tasks.getInput("PackageId", true);
        const packageVersion = tasks.getInput("PackageVersion", true);
        const commentParser = tasks.getInput("CommentParser");
        const replace = tasks.getBoolInput("Replace", true);
        const additionalArguments = tasks.getInput("AdditionalArguments");

        const space = (hasSpaces && spaceName && spaceName.length > 0)
            ? spaceName
            : null;

        const commits = await utils.getBuildChanges(vstsConnection);

        const metaData: IOctopusPackageMetadata = {
            BuildEnvironment: "Azure DevOps",
            CommentParser: commentParser,
            BuildNumber: environment.buildNumber,
            BuildUrl: (
                environment.teamCollectionUri.replace(/\/$/, '')
                + '/' + environment.projectName
                + '/_build/results?buildId=' + environment.buildId
            ),
            VcsType: utils.getVcsTypeFromProvider(environment.buildRepositoryProvider),
            VcsRoot: environment.buildRepositoryUri,
            VcsCommitNumber: environment.buildSourceVersion,
            Commits: commits.map(change => ({ Id: change.id, Comment: change.message }))
        };

        const metadataDir = path.join(environment.agentBuildDirectory, "octo");
        const metadataFile = path.join(metadataDir, `${environment.buildId}-metadata.json`);
        await tasks.mkdirP(metadataDir);
        await tasks.writeFile(metadataFile, JSON.stringify(metaData, null, 2));

        const octo = await utils.getOrInstallOctoCommandRunner("push-metadata");
        const connection = utils.getDefaultOctopusConnectionDetailsOrThrow();
        const configure: Array<(tool: ToolRunner) => ToolRunner> = [
            connectionArguments(connection),
            argumentIfSet(argumentEnquote, "space", space),
            argument("package-id", packageId),
            argument("version", packageVersion),
            argument("metadata-file", metadataFile),
            flag("replace-existing", replace),
            includeArguments(additionalArguments)
        ];

        const code: Number = await octo.map(x => x.launchOcto(configure))
            .getOrElseL((x) => { throw new Error(x); });

        tasks.setResult(tasks.TaskResult.Succeeded, "Succeeded with code " + code);
    } catch (err) {
        tasks.error(err);
        tasks.setResult(tasks.TaskResult.Failed, "Failed to push metadata. " + err.message);
    }
}

run();