/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as tasks from "azure-pipelines-task-lib/task";
import { multiArgument, connectionArguments, includeAdditionalArgumentsAndProxyConfig, flag, argumentEnquote, argumentIfSet, getOrInstallOctoCommandRunner } from "../../Utils/tool";
import { getOptionalCsvInput, getRequiredCsvInput } from "../../Utils/inputs";
import { getDefaultOctopusConnectionDetailsOrThrow, resolveProjectName } from "../../Utils/connection";
import os from "os";

async function run() {
    try {
        tasks.warning("There is a later version of this task, we recommend using the latest version.");
        const connection = getDefaultOctopusConnectionDetailsOrThrow();

        const space = tasks.getInput("Space");
        // @ts-expect-error
        const project = await resolveProjectName(connection, tasks.getInput("Project", true)).then((x) => x.value);

        const from = tasks.getInput("From", true);
        const to = getRequiredCsvInput("To");
        const showProgress = tasks.getBoolInput("ShowProgress");
        const deploymentForTenants = getOptionalCsvInput("DeployForTenants");
        const deployForTenantTags = getOptionalCsvInput("DeployForTentantTags");
        const additionalArguments = tasks.getInput("AdditionalArguments");

        const octo = await getOrInstallOctoCommandRunner("promote-release");

        const configure = [
            // @ts-expect-error
            argumentIfSet(argumentEnquote, "space", space),
            argumentEnquote("project", project),
            connectionArguments(connection),
            // @ts-expect-error
            argumentEnquote("from", from),
            multiArgument(argumentEnquote, "to", to),
            multiArgument(argumentEnquote, "tenant", deploymentForTenants),
            multiArgument(argumentEnquote, "tenanttag", deployForTenantTags),
            flag("progress", showProgress),
            // @ts-expect-error
            includeAdditionalArgumentsAndProxyConfig(connection.url, additionalArguments),
        ];

        const code: number = await octo
            .map((x) => x.launchOcto(configure, "(release;promote;v3)"))
            .getOrElseL((x) => {
                throw new Error(x);
            });

        tasks.setResult(tasks.TaskResult.Succeeded, "Succeeded promoting release with code " + code);
    } catch (error: unknown) {
        if (error instanceof Error) {
            tasks.setResult(tasks.TaskResult.Failed, `"Failed to promote release. ${error.message}${os.EOL}${error.stack}`, true);
        }
    }
}

run();
