import * as tasks from "azure-pipelines-task-lib";
import os from "os";
import { OctoServerConnectionDetails } from "./connection";
import { connectionArguments, includeAdditionalArgumentsAndProxyConfig } from "./inputs";
import { OctopusToolRunner, runOctopusCli } from "./tool";

export async function executeTask(tool: OctopusToolRunner, stepIdentifier: string, connection: OctoServerConnectionDetails, successMessage: string, failureMessage: string, additionalArguments?: string | undefined) {
    return executeWithSetResult(
        async () => {
            connectionArguments(connection, tool);
            includeAdditionalArgumentsAndProxyConfig(connection.url, additionalArguments, tool);

            await runOctopusCli(tool, stepIdentifier);
        },
        successMessage,
        failureMessage
    );
}

export async function executeWithSetResult(func: () => Promise<void>, successMessage: string, failureMessage: string) {
    try {
        await func();

        tasks.setResult(tasks.TaskResult.Succeeded, successMessage);
    } catch (error: unknown) {
        if (error instanceof Error) {
            tasks.setResult(tasks.TaskResult.Failed, `"${failureMessage}${os.EOL}${error.message}${os.EOL}${error.stack}`, true);
        }
    }
}
