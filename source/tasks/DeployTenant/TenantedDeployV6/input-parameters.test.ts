import { Logger } from "@octopusdeploy/api-client";
import { TaskWrapper } from "tasks/Utils/taskInput";
import { getInputParameters } from "./input-parameters";
import * as tasks from "azure-pipelines-task-lib/task";

export class MockTaskWrapper implements TaskWrapper {
    lastResult?: tasks.TaskResult | undefined = undefined;
    lastResultMessage: string | undefined = undefined;
    lastResultDone: boolean | undefined = undefined;

    stringValues: Map<string, string> = new Map<string, string>();
    boolValues: Map<string, boolean> = new Map<string, boolean>();
    outputVariables: Map<string, string> = new Map<string, string>();

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
        this.lastResult = tasks.TaskResult.Succeeded;
        this.lastResultMessage = message;
        this.lastResultDone = done;
    }
    setFailure(message: string, done?: boolean | undefined): void {
        this.lastResult = tasks.TaskResult.Failed;
        this.lastResultMessage = message;
        this.lastResultDone = done;
    }

    setOutputVariable(name: string, value: string): void {
        this.outputVariables.set(name, value);
    }

    getVariable(name: string): string | undefined {
        return this.outputVariables.get(name);
    }
}

describe("getInputParameters", () => {
    let logger: Logger;
    let task: MockTaskWrapper;
    beforeEach(() => {
        logger = {};
        task = new MockTaskWrapper();
    });

    test("all regular fields supplied", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("Variables", "var1: value1\nvar2: value2");
        task.addVariableString("Environment", "dev");
        task.addVariableString("Project", "Awesome project");
        task.addVariableString("ReleaseNumber", "1.0.0");
        task.addVariableString("DeployForTenants", "Tenant 1\nTenant 2");
        task.addVariableString("DeployForTenantTags", "tag set 1/tag 1\ntag set 1/tag 2");

        const inputParameters = getInputParameters(logger, task);
        expect(inputParameters.environment).toBe("dev");
        expect(inputParameters.project).toBe("Awesome project");
        expect(inputParameters.releaseNumber).toBe("1.0.0");
        expect(inputParameters.space).toBe("Default");
        expect(inputParameters.variables).toStrictEqual({ var1: "value1", var2: "value2" });
        expect(inputParameters.tenants).toStrictEqual(["Tenant 1", "Tenant 2"]);
        expect(inputParameters.tenantTags).toStrictEqual(["tag set 1/tag 1", "tag set 1/tag 2"]);

        expect(task.lastResult).toBeUndefined();
        expect(task.lastResultMessage).toBeUndefined();
        expect(task.lastResultDone).toBeUndefined();
    });

    test("variables in additional fields", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("Variables", "var1: value1\nvar2: value2");
        task.addVariableString("AdditionalArguments", "-v var3=value3 --variable var4=value4");
        task.addVariableString("DeployForTenants", "Tenant 1");

        const inputParameters = getInputParameters(logger, task);
        expect(inputParameters.variables).toStrictEqual({ var1: "value1", var2: "value2", var3: "value3", var4: "value4" });
    });

    test("missing space", () => {
        const t = () => {
            getInputParameters(logger, task);
        };
        expect(t).toThrowError("Failed to successfully build parameters: space name is required.");
    });

    test("duplicate variable name, variables field takes precedence", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("Variables", "var1: value1\nvar2: value2");
        task.addVariableString("AdditionalArguments", "-v var1=value3");
        task.addVariableString("DeployForTenants", "Tenant 1");
        const inputParameters = getInputParameters(logger, task);
        expect(inputParameters.variables).toStrictEqual({ var1: "value1", var2: "value2" });
    });

    test("validate tenants and tags", () => {
        task.addVariableString("Space", "Default");

        const t = () => {
            getInputParameters(logger, task);
        };

        expect(t).toThrowError("Failed to successfully build parameters.\nMust provide at least one tenant or tenant tag.");
    });
});
