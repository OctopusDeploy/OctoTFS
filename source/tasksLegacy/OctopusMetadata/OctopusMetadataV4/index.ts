/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as tasks from "azure-pipelines-task-lib/task";
import { ToolRunner } from "azure-pipelines-task-lib/toolrunner";
import * as path from "path";
import { createVstsConnection, getBuildBranch, getBuildChanges, getVcsTypeFromProvider, getVstsEnvironmentVariables } from "../../Utils/environment";
import { getLineSeparatedItems, getOverwriteModeFromReplaceInput } from "../../Utils/inputs";
import { assertOctoVersionAcceptsIds, getOrInstallOctoCommandRunner, connectionArguments, includeAdditionalArgumentsAndProxyConfig, argument, argumentEnquote, argumentIfSet, multiArgument } from "../../Utils/tool";
import { getDefaultOctopusConnectionDetailsOrThrow } from "../../Utils/connection";
import os from "os";

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
        tasks.warning("There is a later version of this task, we recommend using the latest version.");
        const environment = getVstsEnvironmentVariables();
        const vstsConnection = createVstsConnection(environment);

        const space = tasks.getInput("Space");
        // @ts-expect-error
        const packageIds = getLineSeparatedItems(tasks.getInput("PackageId", true));
        const packageVersion = tasks.getInput("PackageVersion", true);
        // @ts-expect-error
        const overwriteMode = getOverwriteModeFromReplaceInput(tasks.getInput("Replace", true));
        const additionalArguments = tasks.getInput("AdditionalArguments");

        const branch = await getBuildBranch(vstsConnection);
        const commits = await getBuildChanges(vstsConnection);

        const buildInformation: IOctopusBuildInformation = {
            BuildEnvironment: "Azure DevOps",
            BuildNumber: environment.buildNumber,
            BuildUrl: environment.teamCollectionUri.replace(/\/$/, "") + "/" + environment.projectName + "/_build/results?buildId=" + environment.buildId,
            // @ts-expect-error
            Branch: branch,
            VcsType: getVcsTypeFromProvider(environment.buildRepositoryProvider),
            VcsRoot: environment.buildRepositoryUri,
            VcsCommitNumber: environment.buildSourceVersion,
            // @ts-expect-error
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

        await assertOctoVersionAcceptsIds();
        const octo = await getOrInstallOctoCommandRunner("build-information");
        const connection = getDefaultOctopusConnectionDetailsOrThrow();
        const configure: Array<(tool: ToolRunner) => ToolRunner> = [
            connectionArguments(connection),
            // @ts-expect-error
            argumentIfSet(argumentEnquote, "space", space),
            multiArgument(argumentEnquote, "package-id", packageIds),
            // @ts-expect-error
            argument("version", packageVersion),
            argumentEnquote("file", buildInformationFile),
            argument("overwrite-mode", overwriteMode),
            // @ts-expect-error
            includeAdditionalArgumentsAndProxyConfig(connection.url, additionalArguments),
        ];

        const code: number = await octo
            .map((x) => x.launchOcto(configure, "(build-information;push;v4)"))
            .getOrElseL((x) => {
                throw new Error(x);
            });

        tasks.setResult(tasks.TaskResult.Succeeded, "Succeeded with code " + code);
    } catch (error: unknown) {
        if (error instanceof Error) {
            tasks.setResult(tasks.TaskResult.Failed, `"Failed to push build information. ${error.message}${os.EOL}${error.stack}`, true);
        }
    }
}

run();
