import { Logger } from "@octopusdeploy/api-client";
import { MockTaskWrapper } from "../../Utils/MockTaskWrapper";
import { createCommandFromInputs } from "./inputCommandBuilder";
import { VstsParameters, IVstsHelper } from "./vsts";

class MockVsts implements IVstsHelper {
    getVsts(_logger: Logger): Promise<VstsParameters> {
        const vsts: VstsParameters = {
            branch: "/refs/head/main",
            environment: {
                projectId: "projectId",
                projectName: "projectName",
                buildNumber: "buildNumber",
                buildId: 1234,
                buildName: "buildName",
                buildRepositoryName: "buildRepositoryName",
                releaseName: "releaseName",
                releaseUri: "releaseUri",
                releaseId: "releaseId",
                teamCollectionUri: "http://teamcollectionuri/",
                defaultWorkingDirectory: "defaultWorkingDirectory",
                buildRepositoryProvider: "buildRepositoryProvider",
                buildRepositoryUri: "buildRepositoryUri",
                buildSourceVersion: "buildSourceVersion",
                agentBuildDirectory: "agentBuildDirectory",
            },
            vcsType: "vcsType",
            commits: [{ Comment: "commit comment", Id: "commitId" }],
        };

        return new Promise((resolve) => resolve(vsts));
    }
}

describe("getInputCommand", () => {
    let logger: Logger;
    let task: MockTaskWrapper;
    let vsts: MockVsts;
    beforeEach(() => {
        logger = {};
        task = new MockTaskWrapper();
        vsts = new MockVsts();
    });

    test("all regular fields supplied", async () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("PackageVersion", "1.2.3");
        task.addVariableString("PackageIds", "Package1\nPackage2");
        task.addVariableString("ReleaseNumber", "1.0.0");
        task.addVariableString("Replace", "true");

        const command = await createCommandFromInputs(logger, task, vsts);
        expect(command.Packages.length).toBe(2);
        expect(command.Packages[0].Id).toBe("Package1");
        expect(command.Packages[0].Version).toBe("1.2.3");
        expect(command.Packages[1].Id).toBe("Package2");
        expect(command.Packages[1].Version).toBe("1.2.3");
        expect(command.Branch).toBe("/refs/head/main");
        expect(command.BuildEnvironment).toBe("Azure DevOps");
        expect(command.spaceName).toBe("Default");
        expect(command.BuildNumber).toBe("buildNumber");
        expect(command.BuildUrl).toBe("http://teamcollectionuri/projectName/_build/results?buildId=1234");
        expect(command.Commits.length).toBe(1);
        expect(command.Commits[0].Id).toBe("commitId");
        expect(command.VcsCommitNumber).toBe("buildSourceVersion");
        expect(command.VcsRoot).toBe("buildRepositoryUri");
        expect(command.VcsType).toBe("vcsType");
        expect(task.lastResult).toBeUndefined();
        expect(task.lastResultMessage).toBeUndefined();
        expect(task.lastResultDone).toBeUndefined();
    });

    test("missing parameters", async () => {
        const t = async () => {
            await createCommandFromInputs(logger, task, vsts);
        };
        await expect(t).rejects.toThrow("Failed to successfully build parameters:\nspace name is required\nmust specify at least one package name");
    });

    test("missing package version", async () => {
        const t = async () => {
            task.addVariableString("Space", "Default");
            task.addVariableString("PackageIds", "Package1");
            await createCommandFromInputs(logger, task, vsts);
        };
        await expect(t).rejects.toThrow("Failed to successfully build parameters:\nmust specify a package version number, in SemVer format");
    });
});
