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
        task.addVariableString("Project", "Awesome project");
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
        task.addVariableString("Project", "Awesome project");
        task.addVariableString("Packages", "Step1:Foo:1.0.0\nBar:2.0.0");
        task.addVariableString("AdditionalArguments", "--package Baz:2.5.0");

        const inputParameters = getInputParameters(logger, task);
        expect(inputParameters.packages).toStrictEqual(["Baz:2.5.0", "Step1:Foo:1.0.0", "Bar:2.0.0"]);
    });

    test("duplicate variable name, variables field takes precedence", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("Project", "Awesome project");
        task.addVariableString("Packages", "Step1:Foo:1.0.0\nBar:2.0.0");
        task.addVariableString("AdditionalArguments", "--package Bar:2.0.0");

        const inputParameters = getInputParameters(logger, task);
        expect(inputParameters.packages).toStrictEqual(["Bar:2.0.0", "Step1:Foo:1.0.0"]);
    });
});
