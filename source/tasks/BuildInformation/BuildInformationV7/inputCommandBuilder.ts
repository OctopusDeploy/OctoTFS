import { CreateOctopusBuildInformationCommand, Logger, PackageIdentity } from "@octopusdeploy/api-client";
import { getLineSeparatedItems } from "../../Utils/inputs";
import { TaskWrapper } from "tasks/Utils/taskInput";
import { IVstsHelper } from "./vsts";

export async function createCommandFromInputs(logger: Logger, task: TaskWrapper, vstsHelper: IVstsHelper): Promise<CreateOctopusBuildInformationCommand> {
    const vsts = await vstsHelper.getVsts(logger);
    const inputPackages = getLineSeparatedItems(task.getInput("PackageIds") || "") || [];
    logger.debug?.(`PackageIds: ${inputPackages}`);
    const packages: PackageIdentity[] = [];
    for (const packageId of inputPackages) {
        packages.push({
            Id: packageId,
            Version: task.getInput("PackageVersion") || "",
        });
    }

    const command: CreateOctopusBuildInformationCommand = {
        spaceName: task.getInput("Space") || "",
        BuildEnvironment: "Azure DevOps",
        BuildNumber: vsts.environment.buildNumber,
        BuildUrl: vsts.environment.teamCollectionUri.replace(/\/$/, "") + "/" + vsts.environment.projectName + "/_build/results?buildId=" + vsts.environment.buildId,
        Branch: vsts.branch || "",
        VcsType: vsts.vcsType,
        VcsRoot: vsts.environment.buildRepositoryUri,
        VcsCommitNumber: vsts.environment.buildSourceVersion,
        Commits: vsts.commits,
        Packages: packages,
    };

    const errors: string[] = [];
    if (!command.spaceName) {
        errors.push("space name is required");
    }

    if (!command.Packages || command.Packages.length === 0) {
        errors.push("must specify at least one package name");
    } else {
        if (!command.Packages[0].Version || command.Packages[0].Version === "") {
            errors.push("must specify a package version number, in SemVer format");
        }
    }

    if (errors.length > 0) {
        throw new Error(`Failed to successfully build parameters:\n${errors.join("\n")}`);
    }

    return command;
}
