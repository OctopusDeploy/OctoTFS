import * as tasks from "azure-pipelines-task-lib/task";

export interface TaskWrapper {
    getInput(name: string, required?: boolean): string | undefined;
    getBoolean(name: string, required?: boolean): boolean | undefined;
    setSuccess(message: string, done?: boolean): void;
    setFailure(message: string, done?: boolean): void;
    setOutputVariable(name: string, value: string): void;
    getVariable(name: string): string | undefined;
    getOutputVariable(step: string, name: string): string | undefined;
}

export class ConcreteTaskWrapper implements TaskWrapper {
    public getInput(name: string, required?: boolean): string | undefined {
        return tasks.getInput(name, required);
    }

    public getBoolean(name: string, required?: boolean): boolean | undefined {
        return tasks.getBoolInput(name, required);
    }

    public setSuccess(message: string, done?: boolean) {
        tasks.setResult(tasks.TaskResult.Succeeded, message, done);
    }

    public setFailure(message: string, done?: boolean) {
        tasks.setResult(tasks.TaskResult.Failed, message, done);
    }

    public setOutputVariable(name: string, value: string) {
        tasks.setVariable(name, value, false, true);
    }

    public getVariable(name: string): string | undefined {
        return tasks.getVariable(name);
    }

    public getOutputVariable(step: string, name: string): string | undefined {
        return tasks.getVariable(`${step}.${name}`);
    }
}
