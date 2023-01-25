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
        task.addVariableString("Project", "Awesome project");
        task.addVariableString("Runbook", "A runbook");
        task.addVariableString("Environments", "dev\nStaging");
        task.addVariableString("Tenants", "Tenant 1\nTenant 2");
        task.addVariableString("TenantTags", "tag set 1/tag 1\ntag set 1/tag 2");
        task.addVariableString("Variables", "var1: value1\nvar2: value2");

        const command = createCommandFromInputs(logger, task);
        expect(command.spaceName).toBe("Default");
        expect(command.ProjectName).toBe("Awesome project");
        expect(command.RunbookName).toBe("A runbook");
        expect(command.EnvironmentNames).toStrictEqual(["dev", "Staging"]);
        expect(command.Tenants).toStrictEqual(["Tenant 1", "Tenant 2"]);
        expect(command.TenantTags).toStrictEqual(["tag set 1/tag 1", "tag set 1/tag 2"]);
        expect(command.Variables).toStrictEqual({ var1: "value1", var2: "value2" });

        expect(task.lastResult).toBeUndefined();
        expect(task.lastResultMessage).toBeUndefined();
        expect(task.lastResultDone).toBeUndefined();
    });
});
