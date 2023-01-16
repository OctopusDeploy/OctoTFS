import commandLineArgs from "command-line-args";
import shlex from "shlex";
import { getLineSeparatedItems } from "../../Utils/inputs";
import { Logger, PromptedVariableValues } from "@octopusdeploy/api-client";
import { TaskWrapper } from "tasks/Utils/taskInput";

export interface InputParameters {
    // Optional: You should prefer the OCTOPUS_SPACE environment variable
    space: string;
    // Required
    project: string;
    releaseNumber: string;
    environment: string;
    tenants: string[];
    tenantTags: string[];

    // Optional
    useGuidedFailure?: boolean;
    variables?: PromptedVariableValues;
}

export function getInputParameters(logger: Logger, task: TaskWrapper): InputParameters {
    const space = task.getInput("Space");
    if (!space) {
        throw new Error("Failed to successfully build parameters: space name is required.");
    }

    const variablesMap: PromptedVariableValues | undefined = {};

    const additionalArguments = task.getInput("AdditionalArguments");
    logger.debug?.("AdditionalArguments:" + additionalArguments);
    if (additionalArguments) {
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

    const parameters: InputParameters = {
        space: task.getInput("Space") || "",
        project: task.getInput("Project", true) || "",
        releaseNumber: task.getInput("ReleaseNumber", true) || "",
        environment: task.getInput("Environment", true) || "",
        useGuidedFailure: task.getBoolean("UseGuidedFailure") || undefined,
        variables: variablesMap || undefined,
        tenants: getLineSeparatedItems(tenantsField || "")?.map((t: string) => t.trim()) || [],
        tenantTags: tags,
    };

    const errors: string[] = [];
    if (parameters.space === "") {
        errors.push("The Octopus space name is required.");
    }

    if (parameters.tenantTags.length === 0 && parameters.tenants.length === 0) {
        errors.push("Must provide at least one tenant or tenant tag.");
    }

    if (errors.length > 0) {
        throw new Error("Failed to successfully build parameters.\n" + errors.join("\n"));
    }

    logger.debug?.(JSON.stringify(parameters));

    return parameters;
}
