import { Logger } from "@octopusdeploy/api-client";
import { getInputParameters } from "./input-parameters";
import { MockTaskWrapper } from "../../Utils/MockTaskWrapper";

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
        const t = () => {
            getInputParameters(logger, task);
        };
        expect(t).toThrowError("Failed to successfully build parameters: space name is required.");
    });

    test("duplicate variable name, variables field takes precedence", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("Variables", "var1: value1\nvar2: value2");
        task.addVariableString("AdditionalArguments", "-v var1=value3");
        const inputParameters = getInputParameters(logger, task);
        expect(inputParameters.variables).toStrictEqual({ var1: "value1", var2: "value2" });
    });

    test("multiline environments", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("Environments", "dev, test\nprod");
        const inputParameters = getInputParameters(logger, task);
        expect(inputParameters.environments).toStrictEqual(["dev", "test", "prod"]);
    });
});
