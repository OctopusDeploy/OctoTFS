import * as tasks from "azure-pipelines-task-lib/task";
import { removeTrailingSlashes, safeTrim } from "tasksLegacy/Utils/inputs";
import { getLineSeparatedItems } from "../../Utils/inputs";

export interface InputParameters {
    packageId: string;
    packageVersion: string;
    outputPath: string;
    sourcePath: string;
    include: string[];
    debugLogging?: boolean;
}

export const getInputs = (): InputParameters => {
    return {
        packageId: tasks.getInput("PackageId", true) || "",
        packageVersion: tasks.getInput("PackageVersion", true) || "",
        outputPath: removeTrailingSlashes(safeTrim(tasks.getPathInput("OutputPath"))) || ".",
        sourcePath: removeTrailingSlashes(safeTrim(tasks.getPathInput("SourcePath"))) || ".",
        include: getLineSeparatedItems(tasks.getInput("Include") || "") || ["**"],
        debugLogging: tasks.getBoolInput("DebugLogging"),
    };
};
