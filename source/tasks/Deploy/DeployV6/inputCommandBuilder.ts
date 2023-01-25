import commandLineArgs from "command-line-args";
import shlex from "shlex";
import { getLineSeparatedItems } from "../../Utils/inputs";
import { CreateDeploymentUntenantedCommandV1, Logger, PromptedVariableValues } from "@octopusdeploy/api-client";
import { TaskWrapper } from "tasks/Utils/taskInput";

export function createCommandFromInputs(logger: Logger, task: TaskWrapper): CreateDeploymentUntenantedCommandV1 {
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
    logger.debug?.("Variables:" + variablesField);
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
    let environments: string[] = [];

    if (environmentsField) {
        const lines = getLineSeparatedItems(environmentsField);
        lines.forEach((l) => {
            environments = environments.concat(l.split(",").map((e: string) => e.trim()));
        });
    }
    logger.debug?.("Environments:" + environmentsField);

    const command: CreateDeploymentUntenantedCommandV1 = {
        spaceName: task.getInput("Space", true) || "",
        ProjectName: task.getInput("Project", true) || "",
        ReleaseVersion: task.getInput("ReleaseNumber", true) || "",
        EnvironmentNames: environments,
        UseGuidedFailure: task.getBoolean("UseGuidedFailure") || undefined,
        Variables: variablesMap || undefined,
    };

    const errors: string[] = [];
    if (command.spaceName === "") {
        errors.push("The Octopus space name is required.");
    }

    if (errors.length > 0) {
        throw new Error("Failed to successfully build parameters.\n" + errors.join("\n"));
    }

    logger.debug?.(JSON.stringify(command));

    return command;
}
