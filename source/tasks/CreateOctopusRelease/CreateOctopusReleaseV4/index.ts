import * as tasks from "azure-pipelines-task-lib/task";
import { createReleaseNotesFile, createVstsConnection, generateReleaseNotesContent, getLinkedReleaseNotes, getVstsEnvironmentVariables } from "../../../Utils/environment";
import { argumentEnquote, argumentIfSet, assertOctoVersionAcceptsIds, connectionArguments, flag, getOrInstallOctoCommandRunner, includeAdditionalArgumentsAndProxyConfig, multiArgument } from "../../../Utils/tool";
import { getOptionalCsvInput } from "../../../Utils/inputs";
import { getDefaultOctopusConnectionDetailsOrThrow } from "../../../Utils/connection";

async function run() {
    try {
        const environmentVariables = getVstsEnvironmentVariables();
        const vstsConnection = createVstsConnection(environmentVariables);
        const connection = getDefaultOctopusConnectionDetailsOrThrow();

        const space = tasks.getInput("Space");
        const project = tasks.getInput("ProjectName", true);
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
        const gitRef = tasks.getInput("GitRef");
        const gitCommit = tasks.getInput("GitCommit");

        await assertOctoVersionAcceptsIds();
        const octo = await getOrInstallOctoCommandRunner("create-release");

        const configure = [
            argumentIfSet(argumentEnquote, "space", space),
            argumentEnquote("project", project),
            argumentIfSet(argumentEnquote, "releaseNumber", releaseNumber),
            argumentIfSet(argumentEnquote, "channel", channel),
            connectionArguments(connection),
            flag("enableServiceMessages", true),
            multiArgument(argumentEnquote, "deployTo", deployToEnvironments),
            argumentIfSet(argumentEnquote, "gitRef", gitRef),
            argumentIfSet(argumentEnquote, "gitCommit", gitCommit),
            flag("progress", deployToEnvironments.length > 0 && deploymentProgress),
            multiArgument(argumentEnquote, "tenant", deployForTenants),
            multiArgument(argumentEnquote, "tenanttag", deployForTenantTags),
        ];

        if (workItemReleaseNotes || changesetCommentReleaseNotes || (customReleaseNotes && /[^\s]/.test(customReleaseNotes))) {
            const linkedReleaseNotes = workItemReleaseNotes || changesetCommentReleaseNotes ? await getLinkedReleaseNotes(vstsConnection, changesetCommentReleaseNotes, workItemReleaseNotes) : "";

            const releaseNotesFile = createReleaseNotesFile(() => {
                return generateReleaseNotesContent(environmentVariables, linkedReleaseNotes, customReleaseNotes);
            }, environmentVariables.defaultWorkingDirectory);

            configure.push(argumentEnquote("releaseNotesFile", releaseNotesFile));
        }

        configure.push(includeAdditionalArgumentsAndProxyConfig(connection.url, additionalArguments));

        const code: number = await octo
            .map((x) => x.launchOcto(configure))
            .getOrElseL((x) => {
                throw new Error(x);
            });

        tasks.setResult(tasks.TaskResult.Succeeded, "Create octopus release succeeded with code " + code);
    } catch (err) {
        tasks.error(err);
        tasks.setResult(tasks.TaskResult.Failed, "Failed to deploy release " + err.message);
    }
}

run();
