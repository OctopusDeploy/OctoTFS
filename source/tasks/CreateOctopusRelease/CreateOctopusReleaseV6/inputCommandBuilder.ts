import commandLineArgs from "command-line-args";
import shlex from "shlex";
import { getLineSeparatedItems } from "../../Utils/inputs";
import { CreateReleaseCommandV1, Logger } from "@octopusdeploy/api-client";
import { TaskWrapper } from "tasks/Utils/taskInput";

export function createCommandFromInputs(logger: Logger, task: TaskWrapper): CreateReleaseCommandV1 {
    const packages: string[] = [];
    let defaultPackageVersion: string | undefined = undefined;

    const additionalArguments = task.getInput("AdditionalArguments");
    logger.debug?.("AdditionalArguments:" + additionalArguments);
    if (additionalArguments) {
        logger.warn?.("Additional arguments are no longer supported and will be removed in future versions. This field has been retained to ease migration from earlier versions of the step but values should be moved to the appropriate fields.");
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

    const command: CreateReleaseCommandV1 = {
        spaceName: task.getInput("Space", true) || "",
        ProjectName: task.getInput("Project", true) || "",
        ReleaseVersion: task.getInput("ReleaseNumber"),
        ChannelName: task.getInput("Channel"),
        PackageVersion: defaultPackageVersion,
        Packages: packages.length > 0 ? packages : undefined,
        ReleaseNotes: task.getInput("ReleaseNotes"),
        GitRef: task.getInput("GitRef"),
        GitCommit: task.getInput("GitCommit"),
    };

    logger.debug?.(JSON.stringify(command));

    return command;
}
