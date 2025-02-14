import { getLineSeparatedItems } from "../../Utils/inputs";
import { CreateRunbookRunCommandV1, Logger, PromptedVariableValues } from "@octopusdeploy/api-client";
import { RunGitRunbookCommand } from "@octopusdeploy/api-client/dist/features/projects/runbooks/runs/RunGitRunbookCommand";
import { TaskWrapper } from "tasks/Utils/taskInput";

// The api-client doesn't have a type for this command that we can differentiate from CreateRunbookRunCommandV1
// so we'll wrap it to make things easier.
export type CreateGitRunbookRunCommandV1 = RunGitRunbookCommand & {
    GitRef: string;
};

export function isCreateGitRunbookRunCommand(command: CreateRunbookRunCommandV1 | CreateGitRunbookRunCommandV1): command is CreateGitRunbookRunCommandV1 {
    return (command as CreateGitRunbookRunCommandV1).GitRef !== undefined;
}

export function createCommandFromInputs(logger: Logger, task: TaskWrapper): CreateRunbookRunCommandV1 | CreateGitRunbookRunCommandV1 {
    const variablesMap: PromptedVariableValues | undefined = {};

    const variablesField = task.getInput("Variables");
    logger.debug?.("Variables: " + variablesField);
    if (variablesField) {
        const variables = getLineSeparatedItems(variablesField).map((p) => p.trim()) || undefined;
        if (variables) {
            for (const variable of variables) {
                const variableMap = variable.split(":").map((x) => x.trim());
                variablesMap[variableMap[0]] = variableMap[1];
            }
        }
    }

    const environmentsField = task.getInput("Environments", true);
    logger.debug?.("Environments: " + environmentsField);
    const tenantsField = task.getInput("Tenants");
    logger.debug?.("Tenants: " + tenantsField);
    const tagsField = task.getInput("TenantTags");
    logger.debug?.("Tenant Tags: " + tagsField);
    const tags = getLineSeparatedItems(tagsField || "")?.map((t: string) => t.trim()) || [];

    const gitRef = task.getInput("GitRef");
    logger.debug?.("GitRef: " + gitRef);

    if (gitRef) {
        const command: CreateGitRunbookRunCommandV1 = {
            spaceName: task.getInput("Space") || "",
            ProjectName: task.getInput("Project", true) || "",
            RunbookName: task.getInput("Runbook", true) || "",
            EnvironmentNames: getLineSeparatedItems(environmentsField || "")?.map((t: string) => t.trim()) || [],
            Tenants: getLineSeparatedItems(tenantsField || "")?.map((t: string) => t.trim()) || [],
            TenantTags: tags,
            UseGuidedFailure: task.getBoolean("UseGuidedFailure") || undefined,
            Variables: variablesMap || undefined,
            GitRef: gitRef,
        };

        logger.debug?.(JSON.stringify(command));

        return command;
    }

    const command: CreateRunbookRunCommandV1 = {
        spaceName: task.getInput("Space") || "",
        ProjectName: task.getInput("Project", true) || "",
        RunbookName: task.getInput("Runbook", true) || "",
        EnvironmentNames: getLineSeparatedItems(environmentsField || "")?.map((t: string) => t.trim()) || [],
        Tenants: getLineSeparatedItems(tenantsField || "")?.map((t: string) => t.trim()) || [],
        TenantTags: tags,
        UseGuidedFailure: task.getBoolean("UseGuidedFailure") || undefined,
        Variables: variablesMap || undefined,
    };

    logger.debug?.(JSON.stringify(command));

    return command;
}
