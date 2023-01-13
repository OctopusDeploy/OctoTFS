import * as tasks from "azure-pipelines-task-lib/task";
import { Logger } from "@octopusdeploy/api-client";
import { Installer } from "./installer";
import os from "os";

async function run() {
    try {
        const version = tasks.getInput("octopusVersion", true) || "";

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

        new Installer("https://api.github.com/repos/OctopusDeploy/cli/releases", os.platform(), os.arch(), logger).run(version);
    } catch (error: unknown) {
        if (error instanceof Error) {
            tasks.setResult(tasks.TaskResult.Failed, `"Failed to execute pack. ${error.message}${os.EOL}${error.stack}`, true);
        } else {
            tasks.setResult(tasks.TaskResult.Failed, `"Failed to execute pack. ${error}`, true);
        }
    }
}

run();
