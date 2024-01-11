/* eslint-disable @typescript-eslint/ban-ts-comment */
import { getOrDownloadOcto, resolvePublishedOctoVersion, addToolToPath, getEmbeddedOcto } from "../../Utils/install";
import * as tasks from "azure-pipelines-task-lib/task";
import * as os from "os";

async function run() {
    tasks.warning("This task is deprecated, please use latest version instead.");
    const version = tasks.getInput("version");
    // @ts-ignore
    const forceEmbedded = /embedded/i.test(version);

    try {
        if (forceEmbedded) {
            console.log("Forcing the use of the embedded Octopus CLI tool.");
            await getEmbeddedOcto(tasks.resolve(__dirname, "embedded")).then(addToolToPath);
        } else {
            const option = await resolvePublishedOctoVersion(version);
            console.log(`Using Octopus CLI tool version ${option.version}`);
            await getOrDownloadOcto(option).then(addToolToPath);
        }

        tasks.setResult(tasks.TaskResult.Succeeded, "");
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (forceEmbedded) {
                tasks.setResult(tasks.TaskResult.Failed, `${error.message}${os.EOL}${error.stack}`, true);
                return;
            }

            console.log(`Failed to resolve Octopus CLI tool version ${version}. Using the embedded version. ${error}`);

            try {
                await getEmbeddedOcto(tasks.resolve(__dirname, "embedded")).then(addToolToPath);
            } catch (embeddedOctoError: unknown) {
                if (embeddedOctoError instanceof Error) {
                    tasks.setResult(tasks.TaskResult.Failed, `${embeddedOctoError.message}${os.EOL}${embeddedOctoError.stack}`, true);
                }
            }
        }
    }
}

run();
