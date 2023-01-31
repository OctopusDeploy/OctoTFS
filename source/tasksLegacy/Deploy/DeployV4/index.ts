/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as tasks from "azure-pipelines-task-lib/task";
import { argumentEnquote, argumentIfSet, assertOctoVersionAcceptsIds, connectionArguments, flag, getOrInstallOctoCommandRunner, includeAdditionalArgumentsAndProxyConfig, multiArgument } from "../../Utils/tool";
import { getOptionalCsvInput, getRequiredCsvInput } from "../../Utils/inputs";
import { getDefaultOctopusConnectionDetailsOrThrow } from "../../Utils/connection";
import os from "os";

async function run() {
    try {
        tasks.warning("There is a later version of this task, we recommend using the latest version.");
        const connection = getDefaultOctopusConnectionDetailsOrThrow();

        const space = tasks.getInput("Space");
        const project = tasks.getInput("Project", true);
        const releaseNumber = tasks.getInput("ReleaseNumber", true);
        const deployToEnvironments = getRequiredCsvInput("Environments");
        const deployForTenants = getOptionalCsvInput("DeployForTenants");
        const deployForTenantTags = getOptionalCsvInput("DeployForTenantTags");
        const showProgress = tasks.getBoolInput("ShowProgress");
        const additionalArguments = tasks.getInput("AdditionalArguments");
        await assertOctoVersionAcceptsIds();
        const octo = await getOrInstallOctoCommandRunner("deploy-release");

        const configure = [
            // @ts-ignore
            argumentIfSet(argumentEnquote, "space", space),
            // @ts-ignore
            argumentEnquote("project", project),
            // @ts-ignore
            argumentEnquote("releaseNumber", releaseNumber),
            connectionArguments(connection),
            multiArgument(argumentEnquote, "deployTo", deployToEnvironments),
            multiArgument(argumentEnquote, "tenant", deployForTenants),
            multiArgument(argumentEnquote, "tenanttag", deployForTenantTags),
            flag("progress", showProgress),
            // @ts-ignore
            includeAdditionalArgumentsAndProxyConfig(connection.url, additionalArguments),
        ];

        let stepIdentifier = "(release;deploy;v4)";
        if (deployForTenants.length > 0 || deployForTenantTags.length > 0) {
            stepIdentifier = "(release;deploy-tenanted;v4)";
        }

        const code: number = await octo
            .map((x) => x.launchOcto(configure, stepIdentifier))
            .getOrElseL((x) => {
                throw new Error(x);
            });

        tasks.setResult(tasks.TaskResult.Succeeded, "Deploy succeeded with code " + code);
    } catch (error: unknown) {
        if (error instanceof Error) {
            tasks.setResult(tasks.TaskResult.Failed, `"Failed to deploy release. ${error.message}${os.EOL}${error.stack}`, true);
        }
    }
}

run();
