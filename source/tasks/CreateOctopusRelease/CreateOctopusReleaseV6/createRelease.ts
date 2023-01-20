import os from "os";
import { Client, CreateReleaseCommandV1, Logger, ReleaseRepository } from "@octopusdeploy/api-client";
import { InputParameters } from "./input-parameters";
import { TaskWrapper } from "tasks/Utils/taskInput";

// Returns the release number that was actually created in Octopus
export async function createReleaseFromInputs(client: Client, parameters: InputParameters, task: TaskWrapper, logger: Logger): Promise<string> {
    logger.info?.("🐙 Creating a release in Octopus Deploy...");
    const command: CreateReleaseCommandV1 = {
        spaceName: parameters.space,
        ProjectName: parameters.project,
        ReleaseVersion: parameters.releaseNumber,
        ChannelName: parameters.channel,
        PackageVersion: parameters.defaultPackageVersion,
        Packages: parameters.packages,
        ReleaseNotes: parameters.releaseNotes,
        GitRef: parameters.gitRef,
        GitCommit: parameters.gitCommit,
    };

    try {
        const repository = new ReleaseRepository(client, parameters.space);
        const response = await repository.create(command);

        client.info(`🎉 Release ${response.ReleaseVersion} created successfully!`);

        task.setOutputVariable("release_number", response.ReleaseVersion);

        return response.ReleaseVersion;
    } catch (error: unknown) {
        if (error instanceof Error) {
            task.setFailure(`"Failed to execute command. ${error.message}${os.EOL}${error.stack}`, true);
        } else {
            task.setFailure(`"Failed to execute command. ${error}`, true);
        }
        throw error;
    }
}
