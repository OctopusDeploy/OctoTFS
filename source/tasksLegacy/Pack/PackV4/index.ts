/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as tasks from "azure-pipelines-task-lib/task";
import * as fs from "fs";
import { ToolRunner } from "azure-pipelines-task-lib/toolrunner";
import { getLineSeparatedItems, isNullOrWhitespace, removeTrailingSlashes, safeTrim } from "../../Utils/inputs";
import { argument, argumentEnquote, argumentIfSet, flag, getOrInstallOctoCommandRunner, includeAdditionalArguments, multiArgument } from "../../Utils/tool";
import os from "os";

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
        // @ts-ignore
        argumentIfSet(argument, "version", inputs.packageVersion),
        argumentIfSet(argument, "compressionlevel", inputs.compressionLevel),
        // @ts-ignore
        argumentIfSet(argumentEnquote, "outFolder", inputs.outputPath),
        // @ts-ignore
        argumentIfSet(argumentEnquote, "basePath", inputs.sourcePath),
        // @ts-ignore
        argumentIfSet(argumentEnquote, "author", inputs.nuGetAuthor),
        // @ts-ignore
        argumentIfSet(argumentEnquote, "title", inputs.nuGetTitle),
        // @ts-ignore
        argumentIfSet(argumentEnquote, "description", inputs.nuGetDescription),
        // @ts-ignore
        argumentIfSet(argumentEnquote, "releaseNotes", inputs.nuGetReleaseNotes),
        argument("overwrite", inputs.overwrite.toString()),
        includeAdditionalArguments(inputs.additionalArguments),
        (tool: ToolRunner) => {
            if (!isNullOrWhitespace(inputs.nuGetReleaseNotesFile) && fs.existsSync(inputs.nuGetReleaseNotesFile) && fs.lstatSync(inputs.nuGetReleaseNotesFile).isFile()) {
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
        // @ts-ignore
        packageId: tasks.getInput("PackageId", true),
        // @ts-ignore
        packageFormat: tasks.getInput("PackageFormat", true),
        packageVersion: tasks.getInput("PackageVersion"),
        outputPath: removeTrailingSlashes(safeTrim(tasks.getPathInput("OutputPath"))) || undefined,
        sourcePath: removeTrailingSlashes(safeTrim(tasks.getPathInput("SourcePath"))) || undefined,
        nuGetAuthor: tasks.getInput("NuGetAuthor"),
        nuGetTitle: tasks.getInput("NuGetTitle"),
        nuGetDescription: tasks.getInput("NuGetDescription"),
        nuGetReleaseNotes: tasks.getInput("NuGetReleaseNotes"),
        nuGetReleaseNotesFile: tasks.getInput("NuGetReleaseNotesFile", false),
        overwrite: tasks.getBoolInput("Overwrite"),
        // @ts-ignore
        include: getLineSeparatedItems(tasks.getInput("Include")),
        listFiles: tasks.getBoolInput("ListFiles"),
        // @ts-ignore
        additionalArguments: tasks.getInput("AdditionalArguments"),
        // @ts-ignore
        compressionLevel: tasks.getInput("CompressionLevel"),
    };
};

async function run() {
    try {
        tasks.warning(`This task is supported, but it no longer actively maintained.
It was originally created for the Octopus CLI when Octopus Deploy only supported NuGet packages.
It is recommended to migrate to the built-in 'Archive Files' task (https://docs.microsoft.com/en-us/azure/devops/pipelines/tasks/utility/archive-files).
Alternatively, if NuGet package metadata is required, consider using the 'NuGet' task (https://docs.microsoft.com/en-us/azure/devops/pipelines/tasks/package/nuget) or the 'dotnet pack' task (https://docs.microsoft.com/en-us/azure/devops/pipelines/tasks/build/dotnet-core-cli).`);

        const octo = await getOrInstallOctoCommandRunner("pack");
        const configureTool = configure(getInputs());

        const code: number = await octo
            .map((x) => x.launchOcto(configureTool, "(package;pack;v4)"))
            .getOrElseL((x) => {
                throw new Error(x);
            });

        tasks.setResult(tasks.TaskResult.Succeeded, "Pack succeeded with code " + code);
    } catch (error: unknown) {
        if (error instanceof Error) {
            tasks.setResult(tasks.TaskResult.Failed, `"Failed to execute octo pack command. ${error.message}${os.EOL}${error.stack}`, true);
        }
    }
}

run();
