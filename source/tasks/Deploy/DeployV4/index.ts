import * as tasks from "azure-pipelines-task-lib/task";
import * as utils from "../../Utils";
import { multiArgument, connectionArguments, includeArguments, flag, argumentEnquote, argumentIfSet } from "../../Utils";

async function run() {
    try {
        const connection = utils.getDefaultOctopusConnectionDetailsOrThrow();

        const space = tasks.getInput("Space");
        const project = tasks.getInput("Project", true);
        const releaseNumber = tasks.getInput("ReleaseNumber", true);
        const deployToEnvironments = utils.getRequiredCsvInput("Environments");
        const deployForTenants = utils.getOptionalCsvInput("DeployForTenants");
        const deployForTenantTags = utils.getOptionalCsvInput("DeployForTenantTags");
        const showProgress = tasks.getBoolInput("ShowProgress");
        const additionalArguments = tasks.getInput("AdditionalArguments");

        await utils.assertOctoVersionAcceptsIds();
        const octo = await utils.getOrInstallOctoCommandRunner("deploy-release");

        const configure = [
            argumentIfSet(argumentEnquote, "space", space),
            argumentEnquote("project", project),
            argumentEnquote("releaseNumber", releaseNumber),
            connectionArguments(connection),
            multiArgument(argumentEnquote, "deployTo", deployToEnvironments),
            multiArgument(argumentEnquote, "tenant", deployForTenants),
            multiArgument(argumentEnquote, "tenanttag", deployForTenantTags),
            flag("progress", showProgress),
            includeArguments(additionalArguments),
        ];

        const code: Number = await octo
            .map((x) => x.launchOcto(configure))
            .getOrElseL((x) => {
                throw new Error(x);
            });

        tasks.setResult(tasks.TaskResult.Succeeded, "Deploy succeeded with code " + code);
    } catch (err) {
        tasks.error(err);
        tasks.setResult(tasks.TaskResult.Failed, "Failed to deploy release " + err.message);
    }
}

run();
