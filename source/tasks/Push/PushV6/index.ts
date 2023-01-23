import { Client, ClientConfiguration, Logger } from "@octopusdeploy/api-client";
import * as tasks from "azure-pipelines-task-lib/task";
import { getDefaultOctopusConnectionDetailsOrThrow } from "../../Utils/connection";
import { getLineSeparatedItems, getOverwriteModeFromReplaceInput, getRequiredInput } from "../../Utils/inputs";
import { Push } from "./push";
import os from "os";
import { getUserAgentApp } from "../../Utils/pluginInformation";

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

        const config: ClientConfiguration = {
            userAgentApp: getUserAgentApp("package", "push", 6),
            instanceURL: connection.url,
            apiKey: connection.apiKey,
            logging: logger,
        };

        const client: Client = await Client.create(config);

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
