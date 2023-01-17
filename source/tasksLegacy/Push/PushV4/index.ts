/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as tasks from "azure-pipelines-task-lib/task";

import { getLineSeparatedItems, getOverwriteModeFromReplaceInput, resolveGlobs } from "../../Utils/inputs";
import { argument, argumentEnquote, argumentIfSet, assertOctoVersionAcceptsIds, connectionArguments, getOrInstallOctoCommandRunner, includeAdditionalArgumentsAndProxyConfig, multiArgument } from "../../Utils/tool";
import { getDefaultOctopusConnectionDetailsOrThrow } from "../../Utils/connection";
import os from "os";

async function run() {
    try {
        tasks.warning("There is a later version of this task, we recommend using the latest version.");
        const connection = getDefaultOctopusConnectionDetailsOrThrow();

        const space = tasks.getInput("Space");
        // @ts-expect-error
        const packages = getLineSeparatedItems(tasks.getInput("Package", true));
        // @ts-expect-error
        const overwriteMode = getOverwriteModeFromReplaceInput(tasks.getInput("Replace", true));
        const additionalArguments = tasks.getInput("AdditionalArguments");

        await assertOctoVersionAcceptsIds();
        const octo = await getOrInstallOctoCommandRunner("push");
        const matchedPackages = await resolveGlobs(packages);

        const configure = [
            connectionArguments(connection),
            // @ts-expect-error
            argumentIfSet(argumentEnquote, "space", space),
            multiArgument(argumentEnquote, "package", matchedPackages),
            argument("overwrite-mode", overwriteMode),
            // @ts-expect-error
            includeAdditionalArgumentsAndProxyConfig(connection.url, additionalArguments),
        ];

        const code: number = await octo
            .map((x) => x.launchOcto(configure, "(package;push;v4)"))
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
