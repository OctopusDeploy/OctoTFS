import { Logger, OverwriteMode } from "@octopusdeploy/api-client";
import { getOverwriteMode } from "./overwriteMode";
import { MockTaskWrapper } from "../../Utils/MockTaskWrapper";

describe("getInputCommand", () => {
    let logger: Logger;
    let task: MockTaskWrapper;
    beforeEach(() => {
        logger = {};
        task = new MockTaskWrapper();
    });

    test("second run", () => {
        task.addVariableString("system.jobAttempt", "2");
        const overwriteMode = getOverwriteMode(logger, task);
        expect(overwriteMode).toBe(OverwriteMode.IgnoreIfExists);
    });

    test("user provided", () => {
        task.addVariableString("Replace", "true");
        const overwriteMode = getOverwriteMode(logger, task);
        expect(overwriteMode).toBe(OverwriteMode.OverwriteExisting);
    });
});
