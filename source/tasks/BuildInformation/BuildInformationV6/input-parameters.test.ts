import { Logger, OverwriteMode } from "@octopusdeploy/api-client";
import { MockTaskWrapper } from "../../Utils/MockTaskWrapper";
import { getInputParameters } from "./inputParameters";

describe("getInputParameters", () => {
    let logger: Logger;
    let task: MockTaskWrapper;
    beforeEach(() => {
        logger = {};
        task = new MockTaskWrapper();
    });

    test("all regular fields supplied", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("PackageVersion", "1.2.3");
        task.addVariableString("PackageId", "Package1\nPackage2");
        task.addVariableString("ReleaseNumber", "1.0.0");
        task.addVariableString("Replace", "true");

        const inputParameters = getInputParameters(false, logger, task);
        expect(inputParameters.version).toBe("1.2.3");
        expect(inputParameters.space).toBe("Default");
        expect(inputParameters.overwriteMode).toBe(OverwriteMode.OverwriteExisting);
        expect(inputParameters.packages).toStrictEqual(["Package1", "Package2"]);

        expect(task.lastResult).toBeUndefined();
        expect(task.lastResultMessage).toBeUndefined();
        expect(task.lastResultDone).toBeUndefined();
    });

    test("in retry mode", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("PackageVersion", "1.2.3");
        task.addVariableString("PackageId", "Package1\nPackage2");
        task.addVariableString("ReleaseNumber", "1.0.0");

        const inputParameters = getInputParameters(true, logger, task);
        expect(inputParameters.version).toBe("1.2.3");
        expect(inputParameters.space).toBe("Default");
        expect(inputParameters.overwriteMode).toBe(OverwriteMode.IgnoreIfExists);
        expect(inputParameters.packages).toStrictEqual(["Package1", "Package2"]);

        expect(task.lastResult).toBeUndefined();
        expect(task.lastResultMessage).toBeUndefined();
        expect(task.lastResultDone).toBeUndefined();
    });

    test("missing parameters", () => {
        const t = () => {
            getInputParameters(false, logger, task);
        };
        expect(t).toThrowError("Failed to successfully build parameters:\nspace name is required\nmust specify at least one package name\nmust specify a package version number, in SemVer format");
    });
});
