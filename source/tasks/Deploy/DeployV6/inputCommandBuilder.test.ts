import { Logger } from "@octopusdeploy/api-client";
import { createCommandFromInputs } from "./inputCommandBuilder";
import { MockTaskWrapper } from "../../Utils/MockTaskWrapper";

describe("getInputCommand", () => {
    let logger: Logger;
    let task: MockTaskWrapper;
    beforeEach(() => {
        logger = {};
        task = new MockTaskWrapper();
    });

    test("all regular fields supplied", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("Variables", "var1: value1\nvar2: value2");
        task.addVariableString("Environments", "dev, test");
        task.addVariableString("Project", "Awesome project");
        task.addVariableString("ReleaseNumber", "1.0.0");

        const command = createCommandFromInputs(logger, task);
        expect(command.EnvironmentNames).toStrictEqual(["dev", "test"]);
        expect(command.ProjectName).toBe("Awesome project");
        expect(command.ReleaseVersion).toBe("1.0.0");
        expect(command.spaceName).toBe("Default");
        expect(command.Variables).toStrictEqual({ var1: "value1", var2: "value2" });

        expect(task.lastResult).toBeUndefined();
        expect(task.lastResultMessage).toBeUndefined();
        expect(task.lastResultDone).toBeUndefined();
    });

    test("variables in additional fields", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("Variables", "var1: value1\nvar2: value2");
        task.addVariableString("AdditionalArguments", "-v var3=value3 --variable var4=value4");
        task.addVariableString("Environments", "test");
        task.addVariableString("Project", "project 1");
        task.addVariableString("ReleaseNumber", "1.2.3");

        const command = createCommandFromInputs(logger, task);
        expect(command.Variables).toStrictEqual({ var1: "value1", var2: "value2", var3: "value3", var4: "value4" });
    });

    test("missing space", () => {
        const t = () => {
            task.addVariableString("Environments", "test");
            createCommandFromInputs(logger, task);
        };
        expect(t).toThrowError("Input required: Space");
    });

    test("duplicate variable name, variables field takes precedence", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("Variables", "var1: value1\nvar2: value2");
        task.addVariableString("AdditionalArguments", "-v var1=value3");
        task.addVariableString("Environments", "test");
        task.addVariableString("Project", "project 1");
        task.addVariableString("ReleaseNumber", "1.2.3");
        const command = createCommandFromInputs(logger, task);
        expect(command.Variables).toStrictEqual({ var1: "value1", var2: "value2" });
    });

    test("multiline environments", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("Environments", "dev, test\nprod");
        task.addVariableString("Project", "project 1");
        task.addVariableString("ReleaseNumber", "1.2.3");
        const command = createCommandFromInputs(logger, task);
        expect(command.EnvironmentNames).toStrictEqual(["dev", "test", "prod"]);
    });
});
