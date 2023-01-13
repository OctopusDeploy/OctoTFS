import * as tasks from "azure-pipelines-task-lib/task";
import { removeTrailingSlashes, safeTrim } from "tasksLegacy/Utils/inputs";
import { getLineSeparatedItems } from "../../Utils/inputs";

export interface InputParameters {
    packageId: string;
    packageVersion: string;
    outputPath: string;
    sourcePath: string;
    include: string[];
    nuGetDescription: string;
    nuGetAuthors: string[];
    nuGetTitle?: string;
    nuGetReleaseNotes?: string;
    nuGetReleaseNotesFile?: string;
    overwrite?: boolean;
}

export const getInputs = (): InputParameters => {
    return {
        packageId: tasks.getInput("PackageId", true) || "",
        packageVersion: tasks.getInput("PackageVersion", true) || "",
        outputPath: removeTrailingSlashes(safeTrim(tasks.getPathInput("OutputPath"))) || ".",
        sourcePath: removeTrailingSlashes(safeTrim(tasks.getPathInput("SourcePath"))) || ".",
        include: getLineSeparatedItems(tasks.getInput("Include") || "**"),
        nuGetDescription: tasks.getInput("NuGetDescription", true) || "",
        nuGetAuthors: getLineSeparatedItems(tasks.getInput("NuGetAuthor", true) || ""),
        nuGetTitle: tasks.getInput("NuGetTitle"),
        nuGetReleaseNotes: tasks.getInput("NuGetReleaseNotes"),
        nuGetReleaseNotesFile: tasks.getInput("NuGetReleaseNotesFile", false),
        overwrite: tasks.getBoolInput("Overwrite"),
    };
};
