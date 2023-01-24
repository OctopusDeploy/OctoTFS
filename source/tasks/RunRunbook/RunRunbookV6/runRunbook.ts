import { Client, CreateRunbookRunCommandV1, RunbookRunRepository, Logger, TenantRepository, EnvironmentRepository } from "@octopusdeploy/api-client";
import os from "os";
import { TaskWrapper } from "tasks/Utils/taskInput";
import { ExecutionResult } from "../../Utils/executionResult";

export async function createRunbookRunFromInputs(client: Client, command: CreateRunbookRunCommandV1, task: TaskWrapper, logger: Logger): Promise<ExecutionResult[]> {
    logger.info?.("🐙 Running a Runbook in Octopus Deploy...");

    try {
        const repository = new RunbookRunRepository(client, command.spaceName);
        const response = await repository.create(command);

        logger.info?.(`🎉 ${response.RunbookRunServerTasks.length} Run${response.RunbookRunServerTasks.length > 1 ? "s" : ""} queued successfully!`);

        if (response.RunbookRunServerTasks.length === 0) {
            throw new Error("Expected at least one run to be queued.");
        }
        if (response.RunbookRunServerTasks[0].ServerTaskId === null || response.RunbookRunServerTasks[0].ServerTaskId === undefined) {
            throw new Error("Server task id was not deserialized correctly.");
        }

        const runbookRunIds = response.RunbookRunServerTasks.map((x) => x.RunbookRunId);

        const runs = await repository.list({ ids: runbookRunIds, take: runbookRunIds.length });

        const envIds = runs.Items.map((d) => d.EnvironmentId || "");
        logger.debug?.(`Environment Ids: ${envIds.join(", ")}`);
        const envRepository = new EnvironmentRepository(client, command.spaceName);
        const envs = await envRepository.list({ ids: envIds, take: envIds.length });

        const tenantIds = runs.Items.map((d) => d.TenantId || "");
        logger.debug?.(`Tenant Ids: ${tenantIds.join(", ")}`);
        const tenantRepository = new TenantRepository(client, command.spaceName);
        const tenants = await tenantRepository.list({ ids: tenantIds, take: tenantIds.length });

        const results = response.RunbookRunServerTasks.map((x) => {
            const filteredTenants = tenants.Items.filter((e) => e.Id === runs.Items.filter((d) => d.TaskId === x.ServerTaskId)[0].TenantId);
            const tenantName = filteredTenants.length > 0 ? filteredTenants[0].Name : null;
            return {
                serverTaskId: x.ServerTaskId,
                environmentName: envs.Items.filter((e) => e.Id === runs.Items.filter((d) => d.TaskId === x.ServerTaskId)[0].EnvironmentId)[0].Name,
                tenantName: tenantName,
                type: "Runbook run",
            } as ExecutionResult;
        });

        const tasksJson = JSON.stringify(results);
        logger.debug?.(`server_tasks: ${tasksJson}`);
        task.setOutputVariable("server_tasks", tasksJson);

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
