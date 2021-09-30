import * as tasks from "azure-pipelines-task-lib/task";
import * as utils from "../../Utils";
import { multiArgument, connectionArguments, includeAdditionalArgumentsAndProxyConfig, flag, argumentEnquote, argumentIfSet } from "../../Utils";

async function run() {
    try {
        const environmentVariables = utils.getVstsEnvironmentVariables();
        const vstsConnection = utils.createVstsConnection(environmentVariables);
        const connection = utils.getDefaultOctopusConnectionDetailsOrThrow();

        const space = tasks.getInput("Space");
        const project = tasks.getInput("ProjectName", true);
        const releaseNumber = tasks.getInput("ReleaseNumber");
        const channel = tasks.getInput("Channel");
        const changesetCommentReleaseNotes = tasks.getBoolInput("ChangesetCommentReleaseNotes");
        const workItemReleaseNotes = tasks.getBoolInput("WorkItemReleaseNotes");
        const customReleaseNotes = tasks.getInput("CustomReleaseNotes");
        const deployToEnvironments = utils.getOptionalCsvInput("DeployToEnvironment");
        const deployForTenants = utils.getOptionalCsvInput("DeployForTenants");
        const deployForTenantTags = utils.getOptionalCsvInput("DeployForTenantTags");
        const deploymentProgress = tasks.getBoolInput("DeploymentProgress");
        const additionalArguments = tasks.getInput("AdditionalArguments");
        const gitRef = tasks.getInput("GitRef");
        const gitCommit = tasks.getInput("GitCommit");

        await utils.assertOctoVersionAcceptsIds();
        const octo = await utils.getOrInstallOctoCommandRunner("create-release");

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
            const linkedReleaseNotes = workItemReleaseNotes || changesetCommentReleaseNotes ? await utils.getLinkedReleaseNotes(vstsConnection, changesetCommentReleaseNotes, workItemReleaseNotes) : "";

            const releaseNotesFile = utils.createReleaseNotesFile(() => {
                return utils.generateReleaseNotesContent(environmentVariables, linkedReleaseNotes, customReleaseNotes);
            }, environmentVariables.defaultWorkingDirectory);

            configure.push(argumentEnquote("releaseNotesFile", releaseNotesFile));
        }

        configure.push(includeAdditionalArgumentsAndProxyConfig(connection.url, additionalArguments));

        const code: Number = await octo
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
