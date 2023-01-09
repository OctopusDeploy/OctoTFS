import { Logger, NuGetPackageBuilder, NuGetPackArgs } from "@octopusdeploy/api-client";
import path from "path";
import fs from "fs";
import { InputParameters } from "./input-parameters";

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
        overwrite: true,
        logger,
    };

    inputs.nuspecArgs = {
        description: parameters.nuGetDescription,
        authors: parameters.nuGetAuthors,
        releaseNotes: parameters.nuGetReleaseNotes,
    };

    if (parameters.nuGetReleaseNotesFile) {
        inputs.nuspecArgs.releaseNotes = fs.readFileSync(parameters.nuGetReleaseNotesFile).toString();
    }

    const packageFilename = await builder.pack(inputs);

    return { filePath: path.join(parameters.outputPath, packageFilename), filename: packageFilename };
}
