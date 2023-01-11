import commandLineArgs from "command-line-args";
import shlex from "shlex";
import os from "os";
import { getLineSeparatedItems } from "../../Utils/inputs";
import { Logger, PromptedVariableValues } from "@octopusdeploy/api-client";
import { TaskWrapper } from "tasks/Utils/taskInput";

export interface InputParameters {
    // Optional: You should prefer the OCTOPUS_SPACE environment variable
    space: string;
    // Required
    project: string;
    releaseNumber: string;
    environments: string[];

    // Optional
    useGuidedFailure?: boolean;
    variables?: PromptedVariableValues;
}

export function getInputParameters(logger: Logger, task: TaskWrapper): InputParameters {
    try {
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

        const environmentsField = task.getInput("Environments");
        logger.debug?.("Environments:" + environmentsField);
        const parameters: InputParameters = {
            space: task.getInput("Space") || "",
            project: task.getInput("Project", true) || "",
            releaseNumber: task.getInput("ReleaseNumber", true) || "",
            environments: environmentsField?.split(",").map((e: string) => e.trim()) || [],
            useGuidedFailure: task.getBoolean("UseGuidedFailure") || undefined,
            variables: variablesMap || undefined,
        };

        const errors: string[] = [];
        if (!parameters.space) {
            errors.push("The Octopus space name is required.");
        }

        if (errors.length > 0) {
            throw new Error(errors.join("\n"));
        }

        logger.debug?.(JSON.stringify(parameters));

        return parameters;
    } catch (error: unknown) {
        if (error instanceof Error) {
            task.setFailure(`"Failed to successfully build parameters. ${error.message}${os.EOL}${error.stack}`, true);
        } else {
            task.setFailure(`"Failed to successfully build parameters. ${error}`, true);
        }
        throw error;
    }
}
