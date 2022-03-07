/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as tasks from "azure-pipelines-task-lib/task";
import { connectionArguments, getOrInstallOctoCommandRunner, includeAdditionalArguments } from "../../Utils/tool";
import { getDefaultOctopusConnectionDetailsOrThrow } from "../../Utils/connection";
import os from "os";

async function run() {
    try {
        const connection = getDefaultOctopusConnectionDetailsOrThrow();
        const args = tasks.getInput("args", false);
        const command = tasks.getInput("command", true);
        // @ts-ignore
        const octo = await getOrInstallOctoCommandRunner(command);

        // @ts-ignore
        const configure = [connectionArguments(connection), includeAdditionalArguments(args)];

        const code: number = await octo
            .map((x) => x.launchOcto(configure))
            .getOrElseL((x) => {
                throw new Error(x);
            });

        tasks.setResult(tasks.TaskResult.Succeeded, `Succeeded executing octo command ${command} with code ${code}`);
    } catch (error: unknown) {
        if (error instanceof Error) {
            tasks.setResult(tasks.TaskResult.Failed, `"Failed to execute octo command. ${error.message}${os.EOL}${error.stack}`, true);
        }
    }
}

run();
