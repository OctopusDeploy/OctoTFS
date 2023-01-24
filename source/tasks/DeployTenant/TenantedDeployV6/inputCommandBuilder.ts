import commandLineArgs from "command-line-args";
import shlex from "shlex";
import { getLineSeparatedItems } from "../../Utils/inputs";
import { CreateDeploymentTenantedCommandV1, Logger, PromptedVariableValues } from "@octopusdeploy/api-client";
import { TaskWrapper } from "tasks/Utils/taskInput";

export function createCommandFromInputs(logger: Logger, task: TaskWrapper): CreateDeploymentTenantedCommandV1 {
    const space = task.getInput("Space");
    if (!space) {
        throw new Error("Failed to successfully build parameters: space name is required.");
    }

    const variablesMap: PromptedVariableValues | undefined = {};

    const additionalArguments = task.getInput("AdditionalArguments");
    logger.debug?.("AdditionalArguments:" + additionalArguments);
    if (additionalArguments) {
        logger.warn?.("Additional arguments are no longer supported and will be removed in future versions. This field has been retained to ease migration from earlier versions of the step but values should be moved to the appropriate fields.");
        const optionDefs = [{ name: "variable", alias: "v", type: String, multiple: true }];
        const splitArgs = shlex.split(additionalArguments);
        const options = commandLineArgs(optionDefs, { argv: splitArgs });
        logger.debug?.(JSON.stringify(options));
        for (const variable of options.variable) {
            const variableMap = variable.split("=").map((x: string) => x.trim());
            variablesMap[variableMap[0]] = variableMap[1];
        }
    }

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

    const tenantsField = task.getInput("DeployForTenants");
    logger.debug?.("Tenants: " + tenantsField);
    const tagsField = task.getInput("DeployForTenantTags");
    logger.debug?.("Tenant Tags: " + tagsField);
    const tags = getLineSeparatedItems(tagsField || "")?.map((t: string) => t.trim()) || [];

    const command: CreateDeploymentTenantedCommandV1 = {
        spaceName: task.getInput("Space") || "",
        ProjectName: task.getInput("Project", true) || "",
        ReleaseVersion: task.getInput("ReleaseNumber", true) || "",
        EnvironmentName: task.getInput("Environment", true) || "",
        Tenants: getLineSeparatedItems(tenantsField || "")?.map((t: string) => t.trim()) || [],
        TenantTags: tags,
        UseGuidedFailure: task.getBoolean("UseGuidedFailure") || undefined,
        Variables: variablesMap || undefined,
    };

    const errors: string[] = [];
    if (command.spaceName === "") {
        errors.push("The Octopus space name is required.");
    }

    if (command.TenantTags.length === 0 && command.Tenants.length === 0) {
        errors.push("Must provide at least one tenant or tenant tag.");
    }

    if (errors.length > 0) {
        throw new Error("Failed to successfully build parameters.\n" + errors.join("\n"));
    }

    logger.debug?.(JSON.stringify(command));

    return command;
}
