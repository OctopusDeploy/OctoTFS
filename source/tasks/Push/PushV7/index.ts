import { Logger } from "@octopusdeploy/api-client";
import * as tasks from "azure-pipelines-task-lib/task";
import { getDefaultOctopusConnectionDetailsOrThrow } from "../../Utils/connection";
import { getLineSeparatedItems, getOverwriteModeFromReplaceInput, getRequiredInput } from "../../Utils/inputs";
import { Push } from "./push";
import os from "os";
import { getClient } from "../../Utils/client";

async function run() {
    try {
        const spaceName = getRequiredInput("Space");
        const packages = getLineSeparatedItems(tasks.getInput("Packages", true) || "");
        const overwriteMode = getOverwriteModeFromReplaceInput(tasks.getInput("Replace", true) || "");

        const connection = getDefaultOctopusConnectionDetailsOrThrow();

        const logger: Logger = {
            debug: (message) => {
                tasks.debug(message);
            },
            info: (message) => console.log(message),
            warn: (message) => tasks.warning(message),
            error: (message, err) => {
                if (err !== undefined) {
                    tasks.error(err.message);
                } else {
                    tasks.error(message);
                }
            },
        };

        const client = await getClient(connection, logger, "package", "push", 6);
        await new Push(client).run(spaceName, packages, overwriteMode);
    } catch (error: unknown) {
        if (error instanceof Error) {
            tasks.setResult(tasks.TaskResult.Failed, `"Failed to execute push. ${error.message}${os.EOL}${error.stack}`, true);
        } else {
            tasks.setResult(tasks.TaskResult.Failed, `"Failed to execute push. ${error}`, true);
        }
    }
}

run();
