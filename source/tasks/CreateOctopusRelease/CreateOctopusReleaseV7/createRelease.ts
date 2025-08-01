import os from "os";
import { Client, CreateReleaseCommandV1, Logger, ReleaseRepository } from "@octopusdeploy/api-client";
import { TaskWrapper } from "tasks/Utils/taskInput";

// Returns the release number that was actually created in Octopus
export async function createReleaseFromInputs(client: Client, command: CreateReleaseCommandV1, task: TaskWrapper, logger: Logger): Promise<string> {
    logger.info?.("🐙 Creating a release in Octopus Deploy...");

    try {
        const repository = new ReleaseRepository(client, command.spaceName);
        const response = await repository.create(command);

        if (command.IgnoreIfAlreadyExists) {
            client.info(`🎉 Release ${response.ReleaseVersion} is ready for deployment!`);
        } else {
            client.info(`🎉 Release ${response.ReleaseVersion} created successfully!`);
        }

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
