import { CreateOctopusBuildInformationCommand, Logger, PackageIdentity } from "@octopusdeploy/api-client";
import { getLineSeparatedItems } from "../../Utils/inputs";
import { TaskWrapper } from "tasks/Utils/taskInput";
import { IVstsHelper } from "./vsts";

export async function getInputCommand(logger: Logger, task: TaskWrapper, vstsHelper: IVstsHelper): Promise<CreateOctopusBuildInformationCommand> {
    const vsts = await vstsHelper.getVsts(logger, task);
    const inputPackages = getLineSeparatedItems(task.getInput("PackageId") || "") || [];
    logger.debug?.(`PackageId: ${inputPackages}`);
    const packages: PackageIdentity[] = [];
    for (const packageId of inputPackages) {
        packages.push({
            Id: packageId,
            Version: task.getInput("PackageVersion") || "",
        });
    }

    const command: CreateOctopusBuildInformationCommand = {
        SpaceName: task.getInput("Space") || "",
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
    if (!command.SpaceName) {
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
