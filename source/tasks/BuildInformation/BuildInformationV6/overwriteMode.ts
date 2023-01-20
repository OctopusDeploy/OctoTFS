import { Logger, OverwriteMode } from "@octopusdeploy/api-client";
import { ReplaceOverwriteMode } from "../../Utils/inputs";
import { TaskWrapper } from "../../Utils/taskInput";

export function getOverwriteMode(logger: Logger, task: TaskWrapper): OverwriteMode {
    const isRetry = parseInt(task.getVariable("system.jobAttempt") || "0") > 1;
    const overwriteMode: ReplaceOverwriteMode =
        (ReplaceOverwriteMode as any)[task.getInput("Replace", false) || ""] || // eslint-disable-line @typescript-eslint/no-explicit-any
        (isRetry ? ReplaceOverwriteMode.IgnoreIfExists : ReplaceOverwriteMode.false);

    let apiOverwriteMode: OverwriteMode;
    switch (overwriteMode) {
        case ReplaceOverwriteMode.true:
            apiOverwriteMode = OverwriteMode.OverwriteExisting;
            break;
        case ReplaceOverwriteMode.IgnoreIfExists:
            apiOverwriteMode = OverwriteMode.IgnoreIfExists;
            break;
        case ReplaceOverwriteMode.false:
            apiOverwriteMode = OverwriteMode.FailIfExists;
            break;
        default:
            apiOverwriteMode = OverwriteMode.FailIfExists;
            break;
    }
    logger.debug?.(`Overwrite mode: ${apiOverwriteMode}`);
    return apiOverwriteMode;
}
