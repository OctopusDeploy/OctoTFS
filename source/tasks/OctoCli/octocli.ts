import * as tasks from "azure-pipelines-task-lib/task";
import * as utils from "../Utils";
import { connectionArguments, includeArguments } from "../Utils/tool";

async function run() {
    try {
        const connection = utils.getDefaultOctopusConnectionDetailsOrThrow();
        const args = tasks.getInput("args", false);
        const command = tasks.getInput("command", true);
        const octo = await utils.getOrInstallOctoCommandRunner(command);

        const configure = [connectionArguments(connection), includeArguments(args)];

        const code: Number = await octo
            .map((x) => x.launchOcto(configure))
            .getOrElseL((x) => {
                throw new Error(x);
            });

        tasks.setResult(tasks.TaskResult.Succeeded, `Succeeded executing octo command ${command} with code ${code}`);
    } catch (err) {
        tasks.error(err);
        tasks.setResult(tasks.TaskResult.Failed, "Failed to execute octo command. " + err.message);
    }
}

run();
