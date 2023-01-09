/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as tasks from "azure-pipelines-task-lib/task";
import * as tl from "azure-pipelines-task-lib";
import { Logger } from "@octopusdeploy/api-client";
import { getInputs } from "./input-parameters";
import os from "os";
import { createPackageFromInputs } from "./create-package";

async function run() {
    try {
        const parameters = getInputs();

        const logger: Logger = {
            debug: (message) => {
                if (parameters.debugLogging == true) {
                    tl.debug(message);
                }
            },
            info: (message) => tl.debug(message),
            warn: (message) => tl.warning(message),
            error: (message, err) => {
                if (err !== undefined) {
                    tl.error(err.message);
                } else {
                    tl.error(message);
                }
            },
        };

        const result = await createPackageFromInputs(parameters, logger);

        tasks.setVariable("PACKAGE_FILE_PATH", result.filePath);
        tasks.setVariable("PACKAGE_FILENAME", result.filename);

        tasks.setResult(tasks.TaskResult.Succeeded, "Pack succeeded");
    } catch (error: unknown) {
        if (error instanceof Error) {
            tasks.setResult(tasks.TaskResult.Failed, `"Failed to execute pack. ${error.message}${os.EOL}${error.stack}`, true);
        }
    }
}

run();
