import { executeCommand, MockOctopusToolRunner } from "../../Utils/testing";
import { BuildInformation } from "./buildInformation";
import { ReplaceOverwriteMode } from "../../Utils/inputs";
import express from "express";
import { Server } from "http";
import { AddressInfo } from "net";
import { mkdtemp, rm, readFile } from "fs/promises";
import path from "path";
import os from "os";

describe("Build Information", () => {
    let tempOutDir: string;
    let octopusUrl: string;
    let server: Server;

    jest.setTimeout(100000);

    beforeAll(async () => {
        tempOutDir = await mkdtemp(path.join(os.tmpdir(), "octopus_"));
    });

    afterAll(async () => {
        await rm(tempOutDir, { recursive: true });
    });

    beforeEach(async () => {
        const app = express();

        app.options("/_apis/Location", (_, res) => {
            res.send(`{
  "value": [
    {
      "id": "e81700f7-3be2-46de-8624-2eb35882fcaa",
      "area": "Location",
      "resourceName": "ResourceAreas",
      "routeTemplate": "_apis/{resource}/{areaId}",
      "resourceVersion": 1,
      "minVersion": "3.2",
      "maxVersion": "7.1",
      "releasedVersion": "0.0"
    }
  ],
  "count": 1
}`);
        });

        app.options("/_apis/build", (_, res) => {
            res.send(`{
  "value": [
    {
      "id": "0cd358e1-9217-4d94-8269-1c1ee6f93dcf",
      "area": "Build",
      "resourceName": "Builds",
      "routeTemplate": "{project}/_apis/build/{resource}/{buildId}",
      "resourceVersion": 7,
      "minVersion": "1.0",
      "maxVersion": "7.1",
      "releasedVersion": "7.0"
    },
    {
      "id": "54572c7b-bbd3-45d4-80dc-28be08941620",
      "area": "build",
      "resourceName": "changes",
      "routeTemplate": "{project}/_apis/{area}/builds/{buildId}/{resource}",
      "resourceVersion": 2,
      "minVersion": "2.0",
      "maxVersion": "7.1",
      "releasedVersion": "7.0"
    }
  ],
  "count": 2
}`);
        });

        app.options("/_apis/git", (_, res) => {
            res.send(`{
  "value": [
    {
      "id": "c2570c3b-5b3f-41b8-98bf-5407bfde8d58",
      "area": "git",
      "resourceName": "commits",
      "routeTemplate": "{project}/_apis/{area}/repositories/{repositoryId}/{resource}/{commitId}",
      "resourceVersion": 1,
      "minVersion": "1.0",
      "maxVersion": "7.1",
      "releasedVersion": "7.0"
    }
  ],
  "count": 1
}`);
        });

        app.get("/test/_apis/build/Builds/1", (_, res) => {
            res.send(`{
  "sourceBranch": "refs/heads/master"
}`);
        });

        app.get("/test/_apis/build/Builds/1/changes", (_, res) => {
            res.send(`{
  "count": 2,
  "value": [
    {
      "id": "539bf76ed13e1dfd0d1cbcffa6f2d0c54517ba98",
      "message": "Merge pull request #219 from OctopusDeploy/john/update",
      "type": "GitHub",
      "author": {
        "displayName": "johnsimons",
        "_links": {
          "avatar": {
            "href": "https://avatars.githubusercontent.com/u/122651?v=4"
          }
        },
        "id": "john.simons@octopus.com",
        "imageUrl": "https://avatars.githubusercontent.com/u/122651?v=4"
      },
      "timestamp": "2022-03-09T05:29:24Z",
      "location": "https://api.github.com/repos/OctopusDeploy/OctoTFS/commits/539bf76ed13e1dfd0d1cbcffa6f2d0c54517ba98",
      "messageTruncated": true,
      "displayUri": "https://github.com/OctopusDeploy/OctoTFS/commit/539bf76ed13e1dfd0d1cbcffa6f2d0c54517ba98"
    },
    {
      "id": "64e0ebd2f609332bfc8f27233c85fd5b6853c76e",
      "message": "Small bug fix with widget",
      "type": "GitHub",
      "author": {
        "displayName": "johnsimons",
        "_links": {
          "avatar": {
            "href": "https://avatars.githubusercontent.com/u/122651?v=4"
          }
        },
        "id": "john.simons@octopus.com",
        "imageUrl": "https://avatars.githubusercontent.com/u/122651?v=4"
      },
      "timestamp": "2022-03-08T01:17:57Z",
      "location": "https://api.github.com/repos/OctopusDeploy/OctoTFS/commits/64e0ebd2f609332bfc8f27233c85fd5b6853c76e",
      "displayUri": "https://github.com/OctopusDeploy/OctoTFS/commit/64e0ebd2f609332bfc8f27233c85fd5b6853c76e"
    }
  ]
}`);
        });

        app.get("/_apis/ResourceAreas", (_, res) => {
            res.send(`{
  "count": 0,
  "value": []
}`);
        });

        app.get("/_apis/git/repositories/OctoTFS/commits/539bf76ed13e1dfd0d1cbcffa6f2d0c54517ba98", (_, res) => {
            res.send(`{
  "comment": "Added README.md"
}`);
        });

        server = await new Promise<Server>((resolve) => {
            const r = app.listen(() => {
                resolve(r);
            });
        });

        const address = server.address() as AddressInfo;
        octopusUrl = `http://localhost:${address.port}`;
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => {
            server.close(() => {
                resolve();
            });
        });
    });

    test("Push build information", async () => {
        process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"] = octopusUrl;
        process.env["BUILD_BUILDNUMBER"] = "1";
        process.env["BUILD_BUILDID"] = "1";
        process.env["SYSTEM_TEAMPROJECT"] = "test";
        process.env["BUILD_REPOSITORY_PROVIDER"] = "TfsGit";
        process.env["AGENT_BUILDDIRECTORY"] = tempOutDir;

        const output = await executeCommand(() =>
            new BuildInformation(new MockOctopusToolRunner(), { url: "http://octopus.com", apiKey: "myapikey", ignoreSslErrors: true }).run(
                "my space",
                ["Hello", "World", "GoodBye"],
                "1.2.3",
                ReplaceOverwriteMode.true,
                "--myAdditionalArgumentToInclude"
            )
        );

        const buildInformationJsonFile = path.join(tempOutDir, "octo", "1-buildinformation.json");

        const buildInformationPayload = await readFile(buildInformationJsonFile, { encoding: "utf8" });

        expect(buildInformationPayload).toBe(`{
  "BuildEnvironment": "Azure DevOps",
  "BuildNumber": "1",
  "BuildUrl": "${octopusUrl}/test/_build/results?buildId=1",
  "Branch": "refs/heads/master",
  "VcsType": "Git",
  "VcsRoot": "",
  "VcsCommitNumber": "",
  "Commits": [
    {
      "Id": "539bf76ed13e1dfd0d1cbcffa6f2d0c54517ba98",
      "Comment": "Added README.md"
    },
    {
      "Id": "64e0ebd2f609332bfc8f27233c85fd5b6853c76e",
      "Comment": "Small bug fix with widget"
    }
  ]
}`);
        expect(output).toContain(
            `build-information --space my space --version 1.2.3 --file ${buildInformationJsonFile} --overwrite-mode OverwriteExisting --package-id Hello --package-id World --package-id GoodBye --server http://octopus.com --apiKey myapikey --ignoreSslErrors --myAdditionalArgumentToInclude`
        );
    });
});
