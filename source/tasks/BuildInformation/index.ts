import * as tasks from "azure-pipelines-task-lib/task";
import { ToolRunner } from "azure-pipelines-task-lib/toolrunner";
import * as utils from "../Utils";
import * as path from "path";

import { connectionArguments, includeAdditionalArgumentsAndProxyConfig, argument, argumentEnquote, argumentIfSet, getOverwriteModeFromReplaceInput, multiArgument } from "../Utils";

export interface IOctopusBuildInformation {
    BuildEnvironment: string;
    BuildNumber: string;
    BuildUrl: string;
    Branch: string;
    VcsType: string;
    VcsRoot: string;
    VcsCommitNumber: string;
    Commits: IOctopusBuildInformationCommit[];
}

export interface IOctopusBuildInformationCommit {
    Id: string;
    Comment: string;
}

async function run() {
    try {
        const environment = utils.getVstsEnvironmentVariables();
        const vstsConnection = utils.createVstsConnection(environment);

        const space = tasks.getInput("Space");
        const packageIds = utils.getLineSeparatedItems(tasks.getInput("PackageId", true));
        const packageVersion = tasks.getInput("PackageVersion", true);
        const overwriteMode = getOverwriteModeFromReplaceInput(tasks.getInput("Replace", true));
        const additionalArguments = tasks.getInput("AdditionalArguments");

        const branch = await utils.getBuildBranch(vstsConnection);
        const commits = await utils.getBuildChanges(vstsConnection);

        const buildInformation: IOctopusBuildInformation = {
            BuildEnvironment: "Azure DevOps",
            BuildNumber: environment.buildNumber,
            BuildUrl: environment.teamCollectionUri.replace(/\/$/, "") + "/" + environment.projectName + "/_build/results?buildId=" + environment.buildId,
            Branch: branch,
            VcsType: utils.getVcsTypeFromProvider(environment.buildRepositoryProvider),
            VcsRoot: environment.buildRepositoryUri,
            VcsCommitNumber: environment.buildSourceVersion,
            Commits: commits.map((change) => ({ Id: change.id, Comment: change.message })),
        };

        if (!environment.agentBuildDirectory) {
            tasks.error("The Build Information step requires build information and therefore is not compatible with use in a Release pipeline.");
            return;
        }

        const buildInformationDir = path.join(environment.agentBuildDirectory, "octo");
        const buildInformationFile = path.join(buildInformationDir, `${environment.buildId}-buildinformation.json`);
        await tasks.mkdirP(buildInformationDir);
        await tasks.writeFile(buildInformationFile, JSON.stringify(buildInformation, null, 2));

        await utils.assertOctoVersionAcceptsIds();
        const octo = await utils.getOrInstallOctoCommandRunner("build-information");
        const connection = utils.getDefaultOctopusConnectionDetailsOrThrow();
        const configure: Array<(tool: ToolRunner) => ToolRunner> = [
            connectionArguments(connection),
            argumentIfSet(argumentEnquote, "space", space),
            multiArgument(argumentEnquote, "package-id", packageIds),
            argument("version", packageVersion),
            argumentEnquote("file", buildInformationFile),
            argument("overwrite-mode", overwriteMode),
            includeAdditionalArgumentsAndProxyConfig(connection.url, additionalArguments),
        ];

        const code: Number = await octo
            .map((x) => x.launchOcto(configure))
            .getOrElseL((x) => {
                throw new Error(x);
            });

        tasks.setResult(tasks.TaskResult.Succeeded, "Succeeded with code " + code);
    } catch (err) {
        tasks.error(err);
        tasks.setResult(tasks.TaskResult.Failed, "Failed to push build information. " + err.message);
    }
}

run();
