import { DownloadEndpointRetriever } from "./downloadEndpointRetriever";
import { mkdtemp, rm } from "fs/promises";
import * as path from "path";
import os from "os";
import express from "express";
import { Server } from "http";
import { AddressInfo } from "net";
import { Logger } from "@octopusdeploy/api-client";

describe("OctopusInstaller", () => {
    let tempOutDir: string;
    let releasesUrl: string;
    let server: Server;

    const msgs: string[] = [];
    const logger: Logger = {
        debug: (message) => {
            msgs.push(message);
        },
        info: (message) => {
            msgs.push(message);
        },
        warn: (message) => {
            msgs.push(message);
        },
        error: (message, err) => {
            if (err !== undefined) {
                msgs.push(err.message);
            } else {
                msgs.push(message);
            }
        },
    };

    jest.setTimeout(100000);

    beforeEach(async () => {
        tempOutDir = await mkdtemp(path.join(os.tmpdir(), "octopus_"));
        process.env["AGENT_TOOLSDIRECTORY"] = tempOutDir;
        process.env["AGENT_TEMPDIRECTORY"] = tempOutDir;

        const app = express();

        app.get("/repos/OctopusDeploy/cli/releases", (_, res) => {
            const latestToolsPayload = `[
                {
                    "tag_name": "v7.4.1",
                    "assets": [
                        {
                            "name": "octopus_7.4.1_windows_amd64.zip",
                            "browser_download_url": "http://localhost:${address.port}/OctopusDeploy/cli/releases/download/v7.4.1/octopus_7.4.1_windows_amd64.zip"
                        }
                    ]
                },
                {
                    "tag_name": "v8.0.0",
                    "assets": [
                        {
                            "name": "octopus_8.0.0_windows_amd64.zip",
                            "browser_download_url": "http://localhost:${address.port}/OctopusDeploy/cli/releases/download/v8.0.0/octopus_8.0.0_windows_amd64.zip"
                        }
                    ]
                },
                {
                    "tag_name": "v8.2.0",
                    "assets": [
                        {
                            "name": "octopus_8.2.0_windows_amd64.zip",
                            "browser_download_url": "http://localhost:${address.port}/OctopusDeploy/cli/releases/download/v8.2.0/octopus_8.2.0_windows_amd64.zip"
                        }
                    ]
                }
                ]`;

            res.send(latestToolsPayload);
        });

        app.get("/OctopusDeploy/cli/releases/download/v7.4.1/octopus_7.4.1_windows_amd64.zip", (_, res) => {
            res.sendStatus(200);
        });

        app.get("/OctopusDeploy/cli/releases/download/v8.0.0/octopus_8.0.0_windows_amd64.zip", (_, res) => {
            res.sendStatus(200);
        });

        app.get("/OctopusDeploy/cli/releases/download/v8.2.0/octopus_8.2.0_windows_amd64.zip", (_, res) => {
            res.sendStatus(200);
        });

        server = await new Promise<Server>((resolve) => {
            const r = app.listen(() => {
                resolve(r);
            });
        });

        const address = server.address() as AddressInfo;
        releasesUrl = `http://localhost:${address.port}/repos/OctopusDeploy/cli/releases`;
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => {
            server.close(() => {
                resolve();
            });
        });

        await rm(tempOutDir, { recursive: true });
    });

    test("Installs specific version", async () => {
        const result = await new DownloadEndpointRetriever(releasesUrl, "win32", "amd64", logger).getEndpoint("8.0.0");
        expect(result.version).toBe("8.0.0");
    });

    test("Installs wildcard version", async () => {
        const result = await new DownloadEndpointRetriever(releasesUrl, "win32", "amd64", logger).getEndpoint("7.*");
        expect(result.version).toBe("7.4.1");
    });

    test("Installs latest of latest", async () => {
        const result = await new DownloadEndpointRetriever(releasesUrl, "win32", "amd64", logger).getEndpoint("*");
        expect(result.version).toBe("8.2.0");
    });
});
