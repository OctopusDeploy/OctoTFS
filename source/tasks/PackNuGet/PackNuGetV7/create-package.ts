import { Logger, NuGetPackageBuilder, NuGetPackArgs } from "@octopusdeploy/api-client";
import path from "path";
import fs from "fs";
import { InputParameters } from "./input-parameters";
import { isNullOrWhitespace } from "../../../tasksLegacy/Utils/inputs";

type createPackageResult = {
    filePath: string;
    filename: string;
};

export async function createPackageFromInputs(parameters: InputParameters, logger: Logger): Promise<createPackageResult> {
    const builder = new NuGetPackageBuilder();
    const inputs: NuGetPackArgs = {
        packageId: parameters.packageId,
        version: parameters.packageVersion,
        outputFolder: parameters.outputPath,
        basePath: parameters.sourcePath,
        inputFilePatterns: parameters.include,
        overwrite: parameters.overwrite,
        logger,
    };

    inputs.nuspecArgs = {
        title: parameters.nuGetTitle,
        description: parameters.nuGetDescription,
        authors: parameters.nuGetAuthors,
        releaseNotes: parameters.nuGetReleaseNotes,
    };

    if (!isNullOrWhitespace(parameters.nuGetReleaseNotesFile) && fs.existsSync(parameters.nuGetReleaseNotesFile) && fs.lstatSync(parameters.nuGetReleaseNotesFile).isFile()) {
        inputs.nuspecArgs.releaseNotes = fs.readFileSync(parameters.nuGetReleaseNotesFile).toString();
    }

    const packageFilename = await builder.pack(inputs);

    return { filePath: path.join(parameters.outputPath, packageFilename), filename: packageFilename };
}
