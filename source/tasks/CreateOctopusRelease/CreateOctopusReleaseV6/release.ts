import {
    Client,
    CreateReleaseCommandV1,
    Logger,
    Project,
    ProjectRepository,
    resolveSpaceId,
} from "@octopusdeploy/api-client";
import { OctoServerConnectionDetails } from "../../Utils/connection";
import { createReleaseFromInputs } from "./createRelease";
import { createCommandFromInputs } from "./inputCommandBuilder";
import os from "os";
import { TaskWrapper } from "tasks/Utils/taskInput";
import path from "path";
import { getVstsEnvironmentVariables } from "../../../tasksLegacy/Utils/environment";
import { v4 as uuidv4 } from "uuid";
import * as tasks from "azure-pipelines-task-lib";
import { getClient } from "../../Utils/client";

export class Release {
    constructor(readonly connection: OctoServerConnectionDetails, readonly task: TaskWrapper, readonly logger: Logger) {}

    public async run() {
        try {
            const command = createCommandFromInputs(this.logger, this.task);
            const client = await getClient(this.connection, this.logger, "release", "create", 6);
            const version = await createReleaseFromInputs(client, command, this.task, this.logger);

            await this.tryCreateSummary(client, command, version);

            this.task.setSuccess("Release creation succeeded.");
        } catch (error: unknown) {
            if (error instanceof Error) {
                this.task.setFailure(`"Failed to successfully create release. ${error.message}${os.EOL}${error.stack}`, true);
            } else {
                this.task.setFailure(`"Failed to successfully create release. ${error}`, true);
            }
            throw error;
        }
    }

    private async tryCreateSummary(client: Client, command: CreateReleaseCommandV1, version: string) {
        const spaceId = await resolveSpaceId(client, command.spaceName);
        const projectRepo = new ProjectRepository(client, command.spaceName);
        const projects = await projectRepo.list({ partialName: command.ProjectName });
        const matchedProjects = projects.Items.filter((p: Project) => p.Name.localeCompare(command.ProjectName) === 0);
        if (matchedProjects.length === 1) {
            const link = `${this.connection.url}app#/${spaceId}/projects/${matchedProjects[0].Id}/deployments/releases/${version}`;
            const markdown = `[Release ${version} created for '${matchedProjects[0].Name}'](${link})`;
            const markdownFile = path.join(getVstsEnvironmentVariables().defaultWorkingDirectory, `${uuidv4()}.md`);
            tasks.writeFile(markdownFile, markdown);
            tasks.addAttachment("Distributedtask.Core.Summary", "Octopus Create Release", markdownFile);
        }
    }
}
