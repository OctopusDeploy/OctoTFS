/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as tasks from "azure-pipelines-task-lib/task";
import { multiArgument, connectionArguments, includeAdditionalArgumentsAndProxyConfig, flag, argumentEnquote, argumentIfSet, getOrInstallOctoCommandRunner } from "../../Utils/tool";
import { createReleaseNotesFile, createVstsConnection, generateReleaseNotesContent, getLinkedReleaseNotes, getVstsEnvironmentVariables } from "../../Utils/environment";
import { getDefaultOctopusConnectionDetailsOrThrow, resolveProjectName } from "../../Utils/connection";
import { getOptionalCsvInput } from "../../Utils/inputs";
import os from "os";

async function run() {
    try {
        tasks.warning("There is a later version of this task, we recommend using the latest version.");
        const environmentVariables = getVstsEnvironmentVariables();
        const vstsConnection = createVstsConnection(environmentVariables);
        const octoConnection = getDefaultOctopusConnectionDetailsOrThrow();

        const space = tasks.getInput("Space");
        // @ts-expect-error
        const project = await resolveProjectName(octoConnection, tasks.getInput("ProjectName", true)).then((x) => x.value);
        const releaseNumber = tasks.getInput("ReleaseNumber");
        const channel = tasks.getInput("Channel");
        const changesetCommentReleaseNotes = tasks.getBoolInput("ChangesetCommentReleaseNotes");
        const workItemReleaseNotes = tasks.getBoolInput("WorkItemReleaseNotes");
        const customReleaseNotes = tasks.getInput("CustomReleaseNotes");
        const deployToEnvironments = getOptionalCsvInput("DeployToEnvironment");
        const deployForTenants = getOptionalCsvInput("DeployForTenants");
        const deployForTenantTags = getOptionalCsvInput("DeployForTenantTags");
        const deploymentProgress = tasks.getBoolInput("DeploymentProgress");
        const additionalArguments = tasks.getInput("AdditionalArguments");

        const octo = await getOrInstallOctoCommandRunner("create-release");

        let linkedReleaseNotes = "";
        if (workItemReleaseNotes || changesetCommentReleaseNotes) {
            linkedReleaseNotes = await getLinkedReleaseNotes(vstsConnection, changesetCommentReleaseNotes, workItemReleaseNotes);
        }

        const releaseNotesFile = createReleaseNotesFile(() => {
            // @ts-expect-error
            return generateReleaseNotesContent(environmentVariables, linkedReleaseNotes, customReleaseNotes);
        }, environmentVariables.defaultWorkingDirectory);

        const configure = [
            // @ts-expect-error
            argumentIfSet(argumentEnquote, "space", space),
            argumentEnquote("project", project),
            // @ts-expect-error
            argumentIfSet(argumentEnquote, "releaseNumber", releaseNumber),
            // @ts-expect-error
            argumentIfSet(argumentEnquote, "channel", channel),
            connectionArguments(octoConnection),
            flag("enableServiceMessages", true),
            multiArgument(argumentEnquote, "deployTo", deployToEnvironments),
            flag("progress", deployToEnvironments.length > 0 && deploymentProgress),
            multiArgument(argumentEnquote, "tenant", deployForTenants),
            multiArgument(argumentEnquote, "tenanttag", deployForTenantTags),
            argumentEnquote("releaseNotesFile", releaseNotesFile),
            // @ts-expect-error
            includeAdditionalArgumentsAndProxyConfig(octoConnection.url, additionalArguments),
        ];

        const code: number = await octo
            .map((x) => x.launchOcto(configure, "(release;create;v3)"))
            .getOrElseL((x) => {
                throw new Error(x);
            });

        tasks.setResult(tasks.TaskResult.Succeeded, "Create octopus release succeeded with code " + code);
    } catch (error: unknown) {
        if (error instanceof Error) {
            tasks.setResult(tasks.TaskResult.Failed, `"Failed to create release. ${error.message}${os.EOL}${error.stack}`, true);
        }
    }
}

run();
