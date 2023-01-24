import { Logger } from "@octopusdeploy/api-client";
import { TaskWrapper } from "tasks/Utils/taskInput";
import { WaitExecutionResult } from "./waiter";

export interface InputParameters {
    space: string;
    step: string;
    tasks: WaitExecutionResult[];
    pollingInterval: number;
    timeout: number;
}

export function getInputParameters(logger: Logger, task: TaskWrapper): InputParameters {
    const space = task.getInput("Space");
    if (!space) {
        throw new Error("Failed to successfully build parameters: space name is required.");
    }

    const step = task.getInput("Step");
    if (!step) {
        throw new Error("Failed to successfully build parameters: step name is required.");
    }

    const tasks = task.getOutputVariable(step, "server_tasks");
    if (tasks === undefined) {
        throw new Error(`Failed to successfully build parameters: cannot find '${step}.server_tasks' variable from execution step`);
    }

    let pollingInterval = 10;
    const pollingIntervalField = task.getInput("PollingInterval");
    if (pollingIntervalField) {
        pollingInterval = +pollingIntervalField;
    }

    let timeoutSeconds = 600;
    const timeoutField = task.getInput("TimeoutAfter");
    if (timeoutField) {
        timeoutSeconds = +timeoutField;
    }

    const parameters: InputParameters = {
        space: task.getInput("Space") || "",
        step: step,
        tasks: JSON.parse(tasks),
        pollingInterval: pollingInterval,
        timeout: timeoutSeconds,
    };

    const errors: string[] = [];
    if (parameters.space === "") {
        errors.push("The Octopus space name is required.");
    }

    if (errors.length > 0) {
        throw new Error("Failed to successfully build parameters.\n" + errors.join("\n"));
    }

    logger.debug?.(`Tasks: \n${JSON.stringify(parameters, null, 2)}`);

    return parameters;
}
