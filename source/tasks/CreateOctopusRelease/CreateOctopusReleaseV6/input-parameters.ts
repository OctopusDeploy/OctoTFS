import commandLineArgs from "command-line-args";
import shlex from "shlex";
import { getLineSeparatedItems } from "../../Utils/inputs";
import { Logger } from "@octopusdeploy/api-client";
import { TaskWrapper } from "tasks/Utils/taskInput";

export interface InputParameters {
    space: string;
    project: string;
    releaseNumber: string | undefined;
    channel: string | undefined;
    defaultPackageVersion: string | undefined;
    packages: string[] | undefined;
    releaseNotes: string | undefined;
    gitRef: string | undefined;
    gitCommit: string | undefined;
}

export function getInputParameters(logger: Logger, task: TaskWrapper): InputParameters {
    const packages: string[] = [];
    let defaultPackageVersion: string | undefined = undefined;

    const additionalArguments = task.getInput("AdditionalArguments");
    logger.debug?.("AdditionalArguments:" + additionalArguments);
    if (additionalArguments) {
        const optionDefs = [
            { name: "package", type: String, multiple: true },
            { name: "defaultPackageVersion", type: String },
            { name: "packageVersion", type: String },
        ];
        const splitArgs = shlex.split(additionalArguments);
        const options = commandLineArgs(optionDefs, { argv: splitArgs });
        logger.debug?.(JSON.stringify(options));
        for (const pkg of options.package) {
            packages.push(pkg.trim());
        }

        // defaultPackageVersion and packageVersion both represent the default package version
        if (options.defaultPackageVersion) {
            defaultPackageVersion = options.defaultPackageVersion;
        }
        if (options.packageVersion) {
            defaultPackageVersion = options.packageVersion;
        }
    }

    const packagesField = task.getInput("Packages");
    logger.debug?.("Packages:" + packagesField);
    if (packagesField) {
        const packagesFieldData = getLineSeparatedItems(packagesField).map((p) => p.trim()) || undefined;
        if (packagesFieldData) {
            for (const packageLine of packagesFieldData) {
                const trimmedPackageLine = packageLine.trim();
                if (packages.indexOf(trimmedPackageLine) < 0) {
                    packages.push(trimmedPackageLine);
                }
            }
        }
    }

    const defaultPackageVersionField = task.getInput("DefaultPackageVersion");
    if (defaultPackageVersionField) {
        defaultPackageVersion = defaultPackageVersionField;
    }

    const parameters: InputParameters = {
        space: task.getInput("Space", true) || "",
        project: task.getInput("Project", true) || "",
        releaseNumber: task.getInput("ReleaseNumber"),
        channel: task.getInput("Channel"),
        defaultPackageVersion: defaultPackageVersion,
        packages: packages.length > 0 ? packages : undefined,
        releaseNotes: task.getInput("ReleaseNotes"),
        gitRef: task.getInput("GitRef"),
        gitCommit: task.getInput("GitCommit"),
    };

    logger.debug?.(JSON.stringify(parameters));

    return parameters;
}
