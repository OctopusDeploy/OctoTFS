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
        task.addVariableString("Environment", "dev");
        task.addVariableString("Project", "Awesome project");
        task.addVariableString("ReleaseNumber", "1.0.0");
        task.addVariableString("DeployForTenants", "Tenant 1\nTenant 2");
        task.addVariableString("DeployForTenantTags", "tag set 1/tag 1\ntag set 1/tag 2");

        const command = createCommandFromInputs(logger, task);
        expect(command.EnvironmentName).toBe("dev");
        expect(command.ProjectName).toBe("Awesome project");
        expect(command.ReleaseVersion).toBe("1.0.0");
        expect(command.spaceName).toBe("Default");
        expect(command.Variables).toStrictEqual({ var1: "value1", var2: "value2" });
        expect(command.Tenants).toStrictEqual(["Tenant 1", "Tenant 2"]);
        expect(command.TenantTags).toStrictEqual(["tag set 1/tag 1", "tag set 1/tag 2"]);

        expect(task.lastResult).toBeUndefined();
        expect(task.lastResultMessage).toBeUndefined();
        expect(task.lastResultDone).toBeUndefined();
    });

    test("variables in additional fields", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("Variables", "var1: value1\nvar2: value2");
        task.addVariableString("AdditionalArguments", "-v var3=value3 --variable var4=value4");
        task.addVariableString("DeployForTenants", "Tenant 1");
        task.addVariableString("Project", "project 1");
        task.addVariableString("Environment", "test");
        task.addVariableString("ReleaseNumber", "1.2.3");

        const command = createCommandFromInputs(logger, task);
        expect(command.Variables).toStrictEqual({ var1: "value1", var2: "value2", var3: "value3", var4: "value4" });
    });

    test("missing space", () => {
        const t = () => {
            createCommandFromInputs(logger, task);
        };
        expect(t).toThrowError("Failed to successfully build parameters: space name is required.");
    });

    test("duplicate variable name, variables field takes precedence", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("Variables", "var1: value1\nvar2: value2");
        task.addVariableString("AdditionalArguments", "-v var1=value3");
        task.addVariableString("DeployForTenants", "Tenant 1");
        task.addVariableString("Project", "project 1");
        task.addVariableString("Environment", "test");
        task.addVariableString("ReleaseNumber", "1.2.3");
        const command = createCommandFromInputs(logger, task);
        expect(command.Variables).toStrictEqual({ var1: "value1", var2: "value2" });
    });

    test("validate tenants and tags", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("Project", "project 1");
        task.addVariableString("ReleaseNumber", "1.2.3");
        task.addVariableString("Environment", "test");
        const t = () => {
            createCommandFromInputs(logger, task);
        };

        expect(t).toThrowError("Failed to successfully build parameters.\nMust provide at least one tenant or tenant tag.");
    });
});
