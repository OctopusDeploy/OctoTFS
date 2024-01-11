/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as tasks from "azure-pipelines-task-lib/task";
import { multiArgument, connectionArguments, includeAdditionalArgumentsAndProxyConfig, flag, argumentEnquote, argumentIfSet, getOrInstallOctoCommandRunner } from "../../Utils/tool";
import { getDefaultOctopusConnectionDetailsOrThrow, resolveProjectName } from "../../Utils/connection";
import { getOptionalCsvInput, getRequiredCsvInput } from "../../Utils/inputs";
import os from "os";

async function run() {
    try {
        tasks.warning("There is a later version of this task, we recommend using the latest version.");
        const connection = getDefaultOctopusConnectionDetailsOrThrow();

        const space = tasks.getInput("Space");
        const releaseNumber = tasks.getInput("ReleaseNumber", true);
        const environments = getRequiredCsvInput("Environments");
        const showProgress = tasks.getBoolInput("ShowProgress");
        const deploymentForTenants = getOptionalCsvInput("DeployForTenants");
        const deployForTenantTags = getOptionalCsvInput("DeployForTenantTags");
        const additionalArguments = tasks.getInput("AdditionalArguments");
        // @ts-ignore
        const project = await resolveProjectName(connection, tasks.getInput("Project", true)).then((x) => x.value);

        const octo = await getOrInstallOctoCommandRunner("deploy-release");

        const configure = [
            // @ts-ignore
            argumentIfSet(argumentEnquote, "space", space),
            argumentEnquote("project", project),
            // @ts-ignore
            argumentEnquote("releaseNumber", releaseNumber),
            connectionArguments(connection),
            multiArgument(argumentEnquote, "deployTo", environments),
            multiArgument(argumentEnquote, "tenant", deploymentForTenants),
            multiArgument(argumentEnquote, "tenanttag", deployForTenantTags),
            flag("progress", showProgress),
            // @ts-ignore
            includeAdditionalArgumentsAndProxyConfig(connection.url, additionalArguments),
        ];

        let stepIdentifier = "(release;deploy;v3)";
        if (deploymentForTenants.length > 0 || deployForTenantTags.length > 0) {
            stepIdentifier = "(release;deploy-tenanted;v3)";
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
