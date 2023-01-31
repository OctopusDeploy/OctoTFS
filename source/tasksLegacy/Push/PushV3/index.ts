/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as tasks from "azure-pipelines-task-lib/task";

import { multiArgument, connectionArguments, includeAdditionalArgumentsAndProxyConfig, flag, argumentEnquote, argumentIfSet, getOrInstallOctoCommandRunner } from "../../Utils/tool";
import { getLineSeparatedItems, resolveGlobs } from "../../Utils/inputs";
import { getDefaultOctopusConnectionDetailsOrThrow } from "../../Utils/connection";
import os from "os";

async function run() {
    try {
        tasks.warning("There is a later version of this task, we recommend using the latest version.");
        const connection = getDefaultOctopusConnectionDetailsOrThrow();

        const space = tasks.getInput("Space");
        // @ts-expect-error
        const packages = getLineSeparatedItems(tasks.getInput("Package", true));
        const replace = tasks.getBoolInput("Replace");
        const additionalArguments = tasks.getInput("AdditionalArguments");

        const octo = await getOrInstallOctoCommandRunner("push");
        const matchedPackages = await resolveGlobs(packages);

        const configure = [
            connectionArguments(connection),
            // @ts-expect-error
            argumentIfSet(argumentEnquote, "space", space),
            multiArgument(argumentEnquote, "package", matchedPackages),
            flag("replace-existing", replace),
            // @ts-expect-error
            includeAdditionalArgumentsAndProxyConfig(connection.url, additionalArguments),
        ];

        const code: number = await octo
            .map((x) => x.launchOcto(configure, "(package;push;v3)"))
            .getOrElseL((x) => {
                throw new Error(x);
            });

        tasks.setResult(tasks.TaskResult.Succeeded, "Succeeded with code " + code);
    } catch (error: unknown) {
        if (error instanceof Error) {
            tasks.setResult(tasks.TaskResult.Failed, `"Failed to push package. ${error.message}${os.EOL}${error.stack}`, true);
        }
    }
}

run();
