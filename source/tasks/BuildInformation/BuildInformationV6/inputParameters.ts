import { Logger, OverwriteMode } from "@octopusdeploy/api-client";
import { getLineSeparatedItems, ReplaceOverwriteMode } from "../../Utils/inputs";
import { TaskWrapper } from "tasks/Utils/taskInput";

export interface InputParameters {
    space: string;
    packages: string[];
    version?: string;
    branch?: string;
    overwriteMode: OverwriteMode;
}

export function getInputParameters(isRetry: boolean, logger: Logger, task: TaskWrapper): InputParameters {
    const overwriteMode = getOverwriteMode(isRetry, logger, task);
    const packagesField = task.getInput("PackageId");
    let packages: string[] = [];

    if (packagesField) {
        packages = getLineSeparatedItems(packagesField);
    }
    logger.debug?.(`PackageId: ${packagesField}`);

    const parameters: InputParameters = {
        space: task.getInput("Space") || "",
        packages: packages,
        version: task.getInput("PackageVersion") || undefined,
        branch: task.getInput("branch") || undefined,
        overwriteMode: overwriteMode,
    };

    const errors: string[] = [];
    if (!parameters.space) {
        errors.push("space name is required");
    }

    if (!parameters.packages || parameters.packages.length === 0) {
        errors.push("must specify at least one package name");
    }

    if (!parameters.version) {
        errors.push("must specify a package version number, in SemVer format");
    }

    if (errors.length > 0) {
        throw new Error(`Failed to successfully build parameters:\n${errors.join("\n")}`);
    }

    return parameters;
}

function getOverwriteMode(isRetry: boolean, logger: Logger, task: TaskWrapper): OverwriteMode {
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
