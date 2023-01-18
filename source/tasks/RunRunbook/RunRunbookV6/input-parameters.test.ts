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
        task.addVariableString("Runbook", "A runbook");
        task.addVariableString("Environments", "dev\nStaging");
        task.addVariableString("Tenants", "Tenant 1\nTenant 2");
        task.addVariableString("TenantTags", "tag set 1/tag 1\ntag set 1/tag 2");
        task.addVariableString("Variables", "var1: value1\nvar2: value2");

        const inputParameters = getInputParameters(logger, task);
        expect(inputParameters.spaceName).toBe("Default");
        expect(inputParameters.ProjectName).toBe("Awesome project");
        expect(inputParameters.RunbookName).toBe("A runbook");
        expect(inputParameters.EnvironmentNames).toStrictEqual(["dev", "Staging"]);
        expect(inputParameters.Tenants).toStrictEqual(["Tenant 1", "Tenant 2"]);
        expect(inputParameters.TenantTags).toStrictEqual(["tag set 1/tag 1", "tag set 1/tag 2"]);
        expect(inputParameters.Variables).toStrictEqual({ var1: "value1", var2: "value2" });

        expect(task.lastResult).toBeUndefined();
        expect(task.lastResultMessage).toBeUndefined();
        expect(task.lastResultDone).toBeUndefined();
    });
});
