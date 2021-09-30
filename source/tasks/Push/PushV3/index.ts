import * as tasks from "azure-pipelines-task-lib/task";
import * as utils from "../../Utils";

import { multiArgument, connectionArguments, includeAdditionalArgumentsAndProxyConfig, flag, argumentEnquote, argumentIfSet } from "../../Utils/tool";

async function run() {
    try {
        const connection = utils.getDefaultOctopusConnectionDetailsOrThrow();

        const space = tasks.getInput("Space");
        const packages = utils.getLineSeparatedItems(tasks.getInput("Package", true));
        const replace = tasks.getBoolInput("Replace");
        const additionalArguments = tasks.getInput("AdditionalArguments");

        const octo = await utils.getOrInstallOctoCommandRunner("push");
        const matchedPackages = await utils.resolveGlobs(packages);

        const configure = [connectionArguments(connection), argumentIfSet(argumentEnquote, "space", space), multiArgument(argumentEnquote, "package", matchedPackages), flag("replace-existing", replace), includeAdditionalArgumentsAndProxyConfig(connection.url, additionalArguments)];

        const code: Number = await octo
            .map((x) => x.launchOcto(configure))
            .getOrElseL((x) => {
                throw new Error(x);
            });

        tasks.setResult(tasks.TaskResult.Succeeded, "Succeeded with code " + code);
    } catch (err) {
        tasks.error(err);
        tasks.setResult(tasks.TaskResult.Failed, "Failed to push package. " + err.message);
    }
}

run();
