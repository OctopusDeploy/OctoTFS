import { Logger } from "@octopusdeploy/api-client";
import { createCommandFromInputs } from "./inputCommandBuilder";
import { MockTaskWrapper } from "../../Utils/MockTaskWrapper";
import * as path from "path";
import fs from "fs";
import os from "os";

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
        task.addVariableString("Channel", "Beta");
        task.addVariableString("ReleaseNumber", "1.0.0");
        task.addVariableString("DefaultPackageVersion", "1.0.1");
        task.addVariableString("Packages", "Step1:Foo:1.0.0\nBar:2.0.0");
        task.addVariableString("GitRef", "main");

        const command = createCommandFromInputs(logger, task);
        expect(command.spaceName).toBe("Default");
        expect(command.ProjectName).toBe("Awesome project");
        expect(command.ChannelName).toBe("Beta");
        expect(command.ReleaseVersion).toBe("1.0.0");
        expect(command.PackageVersion).toBe("1.0.1");
        expect(command.Packages).toStrictEqual(["Step1:Foo:1.0.0", "Bar:2.0.0"]);
        expect(command.GitRef).toBe("main");

        expect(task.lastResult).toBeUndefined();
        expect(task.lastResultMessage).toBeUndefined();
        expect(task.lastResultDone).toBeUndefined();
    });

    test("packages in additional fields", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("Project", "Awesome project");
        task.addVariableString("Packages", "Step1:Foo:1.0.0\nBar:2.0.0");
        task.addVariableString("AdditionalArguments", "--package Baz:2.5.0");

        const command = createCommandFromInputs(logger, task);
        expect(command.Packages).toStrictEqual(["Baz:2.5.0", "Step1:Foo:1.0.0", "Bar:2.0.0"]);
    });

    test("release notes file", async () => {
        const tempOutDir = await fs.mkdtempSync(path.join(os.tmpdir(), "octopus_"));
        const notesPath = path.join(tempOutDir, "notes.txt");

        task.addVariableString("Space", "Default");
        task.addVariableString("Project", "Awesome project");
        task.addVariableString("ReleaseNotesFile", notesPath);

        fs.writeFileSync(notesPath, "this is a release note");
        const command = createCommandFromInputs(logger, task);
        expect(command.ReleaseNotes).toBe("this is a release note");
    });

    test("specifying both release notes and release notes file causes error", async () => {
        const tempOutDir = await fs.mkdtempSync(path.join(os.tmpdir(), "octopus_"));
        const notesPath = path.join(tempOutDir, "notes.txt");

        task.addVariableString("Space", "Default");
        task.addVariableString("Project", "Awesome project");
        task.addVariableString("ReleaseNotes", "inline release notes");
        task.addVariableString("ReleaseNotesFile", notesPath);

        fs.writeFileSync(notesPath, "this is a release note");
        expect(() => createCommandFromInputs(logger, task)).toThrowError("cannot specify ReleaseNotes and ReleaseNotesFile");
    });

    test("duplicate variable name, variables field takes precedence", () => {
        task.addVariableString("Space", "Default");
        task.addVariableString("Project", "Awesome project");
        task.addVariableString("Packages", "Step1:Foo:1.0.0\nBar:2.0.0");
        task.addVariableString("AdditionalArguments", "--package Bar:2.0.0");

        const command = createCommandFromInputs(logger, task);
        expect(command.Packages).toStrictEqual(["Bar:2.0.0", "Step1:Foo:1.0.0"]);
    });
});
