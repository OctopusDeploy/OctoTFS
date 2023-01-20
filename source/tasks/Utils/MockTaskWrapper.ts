import { TaskWrapper } from "tasks/Utils/taskInput";
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

    getInput(name: string, required?: boolean | undefined): string | undefined {
        const value = this.stringValues.get(name);
        if (required && !value) {
            // this replicates the functionality in the Azure Pipeline Task library
            throw new Error(`Input required: ${name}`);
        }
        return value;
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
        return this.stringValues.get(name);
    }

    getOutputVariable(_step: string, name: string): string | undefined {
        return this.getVariable(name);
    }
}
