import { getLineSeparatedItems } from "../../Utils/inputs";
import { CreateRunbookRunCommandV1, Logger, PromptedVariableValues } from "@octopusdeploy/api-client";
import { TaskWrapper } from "tasks/Utils/taskInput";

export function createCommandFromInputs(logger: Logger, task: TaskWrapper): CreateRunbookRunCommandV1 {
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
