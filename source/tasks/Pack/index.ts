import * as tasks from "azure-pipelines-task-lib/task";
import * as fs from "fs";
import * as utils from "../Utils";
import { argument, argumentIfSet, flag, multiArgument, argumentEnquote, includeAdditionalArguments } from "../Utils";
import { ToolRunner } from "azure-pipelines-task-lib/toolrunner";

export interface PackageRequiredInputs {
    packageId: string;
    packageFormat: string;
}
export interface PackageOptionalInputs {
    packageVersion?: string;
    outputPath?: string;
    sourcePath?: string;
    nuGetAuthor?: string;
    nuGetTitle?: string;
    nuGetDescription?: string;
    nuGetReleaseNotes?: string;
    nuGetReleaseNotesFile?: string;
    include?: string[];
    listFiles: boolean;
    overwrite: boolean;
    additionalArguments: string;
    compressionLevel: string;
}

export type PackageInputs = PackageRequiredInputs & PackageOptionalInputs;

export const configure = (inputs: PackageInputs) => {
    return [
        argumentEnquote("id", inputs.packageId),
        argument("format", inputs.packageFormat),
        argumentIfSet(argument, "version", inputs.packageVersion),
        argumentIfSet(argument, "compressionlevel", inputs.compressionLevel),
        argumentIfSet(argumentEnquote, "outFolder", inputs.outputPath),
        argumentIfSet(argumentEnquote, "basePath", inputs.sourcePath),
        argumentIfSet(argumentEnquote, "author", inputs.nuGetAuthor),
        argumentIfSet(argumentEnquote, "title", inputs.nuGetTitle),
        argumentIfSet(argumentEnquote, "description", inputs.nuGetDescription),
        argumentIfSet(argumentEnquote, "releaseNotes", inputs.nuGetReleaseNotes),
        argument("overwrite", inputs.overwrite.toString()),
        includeAdditionalArguments(inputs.additionalArguments),
        (tool: ToolRunner) => {
            if (!utils.isNullOrWhitespace(inputs.nuGetReleaseNotesFile) && fs.existsSync(inputs.nuGetReleaseNotesFile) && fs.lstatSync(inputs.nuGetReleaseNotesFile).isFile()) {
                console.log(`Release notes file: ${inputs.nuGetReleaseNotesFile}`);
                argumentEnquote("releaseNotesFile", inputs.nuGetReleaseNotesFile, tool);
            } else {
                console.log("No release notes file found");
            }
            return tool;
        },
        multiArgument(argumentEnquote, "include", inputs.include || []),
        flag("verbose", inputs.listFiles),
    ];
};

export const getInputs = (): PackageInputs => {
    return {
        packageId: tasks.getInput("PackageId", true),
        packageFormat: tasks.getInput("PackageFormat", true),
        packageVersion: tasks.getInput("PackageVersion"),
        outputPath: utils.removeTrailingSlashes(utils.safeTrim(tasks.getPathInput("OutputPath"))) || undefined,
        sourcePath: utils.removeTrailingSlashes(utils.safeTrim(tasks.getPathInput("SourcePath"))) || undefined,
        nuGetAuthor: tasks.getInput("NuGetAuthor"),
        nuGetTitle: tasks.getInput("NuGetTitle"),
        nuGetDescription: tasks.getInput("NuGetDescription"),
        nuGetReleaseNotes: tasks.getInput("NuGetReleaseNotes"),
        nuGetReleaseNotesFile: tasks.getInput("NuGetReleaseNotesFile", false),
        overwrite: tasks.getBoolInput("Overwrite"),
        include: utils.getLineSeparatedItems(tasks.getInput("Include")),
        listFiles: tasks.getBoolInput("ListFiles"),
        additionalArguments: tasks.getInput("AdditionalArguments"),
        compressionLevel: tasks.getInput("CompressionLevel"),
    };
};

async function run() {
    try {
        const octo = await utils.getOrInstallOctoCommandRunner("pack");
        const configureTool = configure(getInputs());

        const code: Number = await octo
            .map((x) => x.launchOcto(configureTool))
            .getOrElseL((x) => {
                throw new Error(x);
            });

        tasks.setResult(tasks.TaskResult.Succeeded, "Pack succeeded with code " + code);
    } catch (err) {
        tasks.error(err);
        tasks.setResult(tasks.TaskResult.Failed, "Failed to execute octo pack command. " + err.message);
    }
}

run();
