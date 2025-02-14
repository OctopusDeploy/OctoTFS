import * as tools from "azure-pipelines-tool-lib";
import * as tasks from "azure-pipelines-task-lib";
import os from "os";
import path from "path";
import { executeWithSetResult } from "../../Utils/octopusTasks";
import { DownloadEndpointRetriever, Endpoint } from "./downloadEndpointRetriever";

const TOOL_NAME = "octo";

const osPlat: string = os.platform();

export class Installer {
    constructor(readonly octopurlsUrl: string) {}

    public async run(versionSpec: string) {
        await executeWithSetResult(
            async () => {
                tasks.warning("This task is using a deprecated version of the Octopus CLI, we recommend using the latest version.");
                const endpoint = await new DownloadEndpointRetriever(this.octopurlsUrl).getEndpoint(versionSpec);
                let toolPath = tools.findLocalTool(TOOL_NAME, endpoint.version);

                if (!toolPath) {
                    toolPath = await this.installTool(endpoint);
                    toolPath = tools.findLocalTool(TOOL_NAME, endpoint.version);
                }

                tools.prependPath(toolPath);
            },
            `Installed octo v${versionSpec}.`,
            `Failed to install octo v${versionSpec}.`
        );
    }

    private async installTool(endpoint: Endpoint): Promise<string> {
        if (!endpoint.downloadUrl) {
            throw Error(`Failed to download Octopus CLI tool version ${endpoint.version}.`);
        }

        const downloadPath = await tools.downloadTool(endpoint.downloadUrl);

        //
        // Extract
        //
        let extPath: string;
        if (osPlat == "win32") {
            extPath = tasks.getVariable("Agent.TempDirectory") || "";
            if (!extPath) {
                throw new Error("Expected Agent.TempDirectory to be set");
            }

            extPath = path.join(extPath, "n"); // use as short a path as possible due to nested node_modules folders
            extPath = await tools.extractZip(downloadPath, extPath);
        } else {
            extPath = await tools.extractTar(downloadPath);
        }

        return await tools.cacheDir(extPath, TOOL_NAME, endpoint.version);
    }
}
