/* eslint-disable @typescript-eslint/no-unused-vars */
import { Logger } from "@octopusdeploy/api-client";
import { TaskResult } from "azure-pipelines-task-lib";
import { TaskWrapper } from "tasks/Utils/taskInput";
import { getInputParameters } from "./input-parameters";

class mockTaskWrapper implements TaskWrapper {
    lastResult?: TaskResult | undefined = undefined;
    lastResultMessage: string | undefined = undefined;
    lastResultDone: boolean | undefined = undefined;

    stringValues: Map<string, string> = new Map<string, string>();
    boolValues: Map<string, boolean> = new Map<string, boolean>();

    addVariableString(name: string, value: string) {
        this.stringValues.set(name, value);
    }

    addVariableBoolean(name: string, value: boolean) {
        this.boolValues.set(name, value);
    }

    getInput(name: string, _required?: boolean | undefined): string | undefined {
        return this.stringValues.get(name);
    }

    getBoolean(name: string, _required?: boolean | undefined): boolean | undefined {
        return this.boolValues.get(name);
    }

    setSuccess(message: string, done?: boolean | undefined): void {
        this.lastResult = TaskResult.Succeeded;
        this.lastResultMessage = message;
        this.lastResultDone = done;
    }
    setFailure(message: string, done?: boolean | undefined): void {
        this.lastResult = TaskResult.Failed;
        this.lastResultMessage = message;
        this.lastResultDone = done;
    }
}
describe("getInputParameters", () => {
    const task = new mockTaskWrapper();
    const logger: Logger = {};
    test("all regular fields supplied", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("Variables", "var1: value1\nvar2: value2");
        task.addVariableString("Environments", "dev, test");
        task.addVariableString("Project", "Awesome project");
        task.addVariableString("ReleaseNumber", "1.0.0");

        const inputParameters = getInputParameters(logger, task);
        expect(inputParameters.environments).toStrictEqual(["dev", "test"]);
        expect(inputParameters.project).toBe("Awesome project");
        expect(inputParameters.releaseNumber).toBe("1.0.0");
        expect(inputParameters.space).toBe("Default");
        expect(inputParameters.variables).toStrictEqual({ var1: "value1", var2: "value2" });

        expect(task.lastResult).toBeUndefined();
        expect(task.lastResultMessage).toBeUndefined();
        expect(task.lastResultDone).toBeUndefined();
    });

    test("variables in additional fields", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("Variables", "var1: value1\nvar2: value2");
        task.addVariableString("AdditionalArguments", "-v var3=value3 --variable var4=value4");

        const inputParameters = getInputParameters(logger, task);
        expect(inputParameters.variables).toStrictEqual({ var1: "value1", var2: "value2", var3: "value3", var4: "value4" });
    });

    test("missing space", () => {
        try {
            getInputParameters(logger, task);
            // eslint-disable-next-line no-empty
        } catch {}
        expect(task.lastResult).toBe(TaskResult.Failed);
        expect(task.lastResultMessage).toContain("Failed to successfully build parameters. The Octopus space name is required.");
        expect(task.lastResultDone).toBeTruthy();
    });
});
