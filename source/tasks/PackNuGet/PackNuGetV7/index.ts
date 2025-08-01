/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as tasks from "azure-pipelines-task-lib/task";
import { Logger } from "@octopusdeploy/api-client";
import { getInputs } from "./input-parameters";
import os from "os";
import { createPackageFromInputs } from "./create-package";

async function run() {
    try {
        const parameters = getInputs();

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

        const result = await createPackageFromInputs(parameters, logger);

        tasks.setVariable("package_file_path", result.filePath);
        tasks.setVariable("package_filename", result.filename);

        tasks.setResult(tasks.TaskResult.Succeeded, "Pack succeeded");
    } catch (error: unknown) {
        if (error instanceof Error) {
            tasks.setResult(tasks.TaskResult.Failed, `"Failed to execute pack. ${error.message}${os.EOL}${error.stack}`, true);
        } else {
            tasks.setResult(tasks.TaskResult.Failed, `"Failed to execute pack. ${error}`, true);
        }
    }
}

run();
