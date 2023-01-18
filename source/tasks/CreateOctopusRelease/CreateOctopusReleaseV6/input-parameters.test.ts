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
        task.addVariableString("ProjectName", "Awesome project");
        task.addVariableString("Channel", "Beta");
        task.addVariableString("ReleaseNumber", "1.0.0");
        task.addVariableString("DefaultPackageVersion", "1.0.1");
        task.addVariableString("Packages", "Step1:Foo:1.0.0\nBar:2.0.0");
        task.addVariableString("GitRef", "main");

        const inputParameters = getInputParameters(logger, task);
        expect(inputParameters.space).toBe("Default");
        expect(inputParameters.project).toBe("Awesome project");
        expect(inputParameters.channel).toBe("Beta");
        expect(inputParameters.releaseNumber).toBe("1.0.0");
        expect(inputParameters.defaultPackageVersion).toBe("1.0.1");
        expect(inputParameters.packages).toStrictEqual(["Step1:Foo:1.0.0", "Bar:2.0.0"]);
        expect(inputParameters.gitRef).toBe("main");

        expect(task.lastResult).toBeUndefined();
        expect(task.lastResultMessage).toBeUndefined();
        expect(task.lastResultDone).toBeUndefined();
    });

    test("packages in additional fields", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("ProjectName", "Awesome project");
        task.addVariableString("Packages", "Step1:Foo:1.0.0\nBar:2.0.0");
        task.addVariableString("AdditionalArguments", "--package Baz:2.5.0");

        const inputParameters = getInputParameters(logger, task);
        expect(inputParameters.packages).toStrictEqual(["Baz:2.5.0", "Step1:Foo:1.0.0", "Bar:2.0.0"]);
    });

    test("duplicate variable name, variables field takes precedence", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("ProjectName", "Awesome project");
        task.addVariableString("Packages", "Step1:Foo:1.0.0\nBar:2.0.0");
        task.addVariableString("AdditionalArguments", "--package Bar:2.0.0");

        const inputParameters = getInputParameters(logger, task);
        expect(inputParameters.packages).toStrictEqual(["Bar:2.0.0", "Step1:Foo:1.0.0"]);
    });
});
