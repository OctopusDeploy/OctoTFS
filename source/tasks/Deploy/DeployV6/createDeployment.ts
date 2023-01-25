import { Client, CreateDeploymentUntenantedCommandV1, DeploymentRepository, EnvironmentRepository, Logger } from "@octopusdeploy/api-client";
import os from "os";
import { TaskWrapper } from "../../Utils/taskInput";
import { ExecutionResult } from "../../Utils/executionResult";

export async function createDeploymentFromInputs(client: Client, command: CreateDeploymentUntenantedCommandV1, task: TaskWrapper, logger: Logger): Promise<ExecutionResult[]> {

    logger.info?.("🐙 Deploying a release in Octopus Deploy...");

    try {
        const deploymentRepository = new DeploymentRepository(client, command.spaceName);
        const response = await deploymentRepository.create(command);

        client.info(`🎉 ${response.DeploymentServerTasks.length} Deployment${response.DeploymentServerTasks.length > 1 ? "s" : ""} queued successfully!`);

        if (response.DeploymentServerTasks.length === 0) {
            throw new Error("Expected at least one deployment to be queued.");
        }
        if (response.DeploymentServerTasks[0].ServerTaskId === null || response.DeploymentServerTasks[0].ServerTaskId === undefined) {
            throw new Error("Server task id was not deserialized correctly.");
        }

        const deploymentIds = response.DeploymentServerTasks.map((x) => x.DeploymentId);

        const deployments = await deploymentRepository.list({ ids: deploymentIds, take: deploymentIds.length });

        const envIds = deployments.Items.map((d) => d.EnvironmentId);
        const envRepository = new EnvironmentRepository(client, command.spaceName);
        const environments = await envRepository.list({ ids: envIds, take: envIds.length });

        const results = response.DeploymentServerTasks.map((x) => {
            return {
                serverTaskId: x.ServerTaskId,
                environmentName: environments.Items.filter((e) => e.Id === deployments.Items.filter((d) => d.TaskId === x.ServerTaskId)[0].EnvironmentId)[0].Name,
                type: "Deployment",
            } as ExecutionResult;
        });

        task.setOutputVariable("server_tasks", JSON.stringify(results));

        return results;
    } catch (error: unknown) {
        if (error instanceof Error) {
            task.setFailure(`"Failed to execute command. ${error.message}${os.EOL}${error.stack}`, true);
        } else {
            task.setFailure(`"Failed to execute command. ${error}`, true);
        }
        throw error;
    }
}
