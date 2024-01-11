import * as path from "path";
import * as fs from "fs";
import * as tasks from "azure-pipelines-task-lib/task";
import * as tools from "azure-pipelines-tool-lib/tool";
import * as TypedRestClient from "typed-rest-client/RestClient";
import { head, filter } from "ramda";
import { IProxyConfiguration } from "typed-rest-client/Interfaces";
import { ToolName, ToolNameBeforeV7 } from "./tool";

interface LatestResponse {
    latest: string;
    downloads: DownloadOption[];
}

type DownloadOption = {
    version: string;
    template: string;
    location: string;
    extension: string;
    platform?: string;
    architecture?: string;
};

type Primitive = undefined | null | boolean | number | string;

interface Dictionary {
    [key: string]: Primitive;
}

const RestClient = TypedRestClient.RestClient;
const OctopurlsUrl = "https://g.octopushq.com";

const applyTemplate = (dictionary: Dictionary, template: string) => {
    return Object.keys(dictionary).reduce((result, key) => result.replace(new RegExp(`{${key}}`, "g"), dictionary[key] ? String(dictionary[key]) : ""), template);
};

const isPortableDownloadOption = (option: DownloadOption) => {
    return option.platform === "portable" && option.extension === ".zip";
};

const filterPortableDownload = (options: DownloadOption[]) => head(filter(isPortableDownloadOption, options));

const extract = (archivePath: string) => {
    return tools.extractZip(archivePath);
};

function getExecutableExtension(): string {
    return ".dll";
}

function getLocalTool(version: string): string {
    console.log("Checking local tool cache");
    return tools.findLocalTool(ToolName, version) || tools.findLocalTool(ToolNameBeforeV7, version);
}

function findOcto(rootFolder: string) {
    const octoPath = [path.join(rootFolder, "*" + ToolName + getExecutableExtension()), path.join(rootFolder, "*" + ToolNameBeforeV7 + getExecutableExtension())];
    console.log(`Looking for ${octoPath}`);
    const allPaths = tasks.find(rootFolder);
    const matches = tasks.match(allPaths, octoPath, rootFolder);
    return matches[0];
}

async function getOrDownloadOcto(option: DownloadOption, download?: (option: DownloadOption) => Promise<string>, extractTool = true): Promise<string> {
    let cachedToolPath = getLocalTool(option.version);

    if (!cachedToolPath) {
        try {
            console.log("Attempting to download the Octopus CLI tool");
            const downloadPath = await (download !== undefined && download != null ? download(option) : tools.downloadTool(option.location));
            const toolPath = extractTool ? await extract(downloadPath) : downloadPath;

            tools.debug(`Adding ${ToolName} ${option.version} to cache`);
            tasks.writeFile(path.join(toolPath, `${ToolName}.cmd`), `dotnet "%~dp0/${ToolName}.dll" %*`);
            cachedToolPath = await tools.cacheDir(toolPath, ToolName, option.version);
        } catch (exception) {
            throw new Error(`Failed to download Octopus CLI tool version ${option.version}. ${exception}`);
        }
    }

    const octoPath = findOcto(cachedToolPath);
    if (!octoPath) {
        throw new Error("The Octopus CLI tool wasn't found in tools directory");
    }

    tools.debug(`Found ${ToolName} at ${octoPath}`);

    fs.chmodSync(octoPath, "777");

    tools.debug(`chmod for ${octoPath} applied`);

    return octoPath;
}

async function resolvePublishedOctoVersion(version?: string): Promise<DownloadOption> {
    if (!version) {
        version = "latest";
    }
    console.log(`Attempting to contact ${OctopurlsUrl} to find Octopus CLI tool version ${version}`);

    const proxyConfiguration = tasks.getHttpProxyConfiguration(OctopurlsUrl);
    let proxySettings: IProxyConfiguration | undefined = undefined;

    if (proxyConfiguration) {
        console.log(
            "Using agent configured proxy. If this command should not be sent via the agent's proxy, you might need to add or modify the agent's .proxybypass file. See https://docs.microsoft.com/en-us/azure/devops/pipelines/agents/proxy#specify-proxy-bypass-urls."
        );
        proxySettings = {
            proxyUrl: proxyConfiguration.proxyUrl,
            proxyUsername: proxyConfiguration.proxyUsername,
            proxyPassword: proxyConfiguration.proxyPassword,
            proxyBypassHosts: proxyConfiguration.proxyBypassHosts,
        };
    }

    const octopurls = new RestClient("OctoTFS/Tasks", OctopurlsUrl, undefined, { proxy: proxySettings });

    const response = await octopurls.get<LatestResponse>("LatestTools");

    if (response.result === null || response.result === undefined) {
        throw Error(`Failed to resolve Octopus CLI tool version ${version}. Endpoint returned status code ${response.statusCode})`);
    }

    const option = filterPortableDownload(response.result.downloads);

    if (option === null || option === undefined) {
        throw Error(`Failed to resolve the Octopus CLI tool portable download location. The result did not contain the download location.`);
    }

    if (version === "latest" || version === response.result.latest) {
        return option;
    }

    //Adjust the version and location to point to the specified version
    const result = { ...option, version };
    result.location = applyTemplate(result, result.template);

    return result;
}

function addToolToPath(toolPath: string) {
    if (!process.env["PATH"]?.startsWith(path.dirname(toolPath))) {
        tools.debug(`Adding ${ToolName} to path`);
        tools.prependPath(path.dirname(toolPath));
    }

    return toolPath;
}

async function getEmbeddedOcto(folderPath: string): Promise<string> {
    const versionPath = path.join(folderPath, "version.json");
    const option = <DownloadOption>JSON.parse(await readFile(versionPath));
    const tempDirectory = getAgentTempDirectory();

    tasks.cp(folderPath, tempDirectory, "-rf");

    if (!option) {
        throw "Could not resolve the original download location of the embedded Octopus CLI tool.";
    }

    console.log(`Using the embedded Octopus CLI tool (version ${option.version}).`);

    return getOrDownloadOcto(
        option,
        () => {
            return new Promise((resolve) => resolve(path.join(tempDirectory, path.basename(folderPath), "bin")));
        },
        false
    );
}

async function readFile(path: string, encoding: BufferEncoding = "utf8"): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        fs.readFile(path, { encoding: encoding }, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

function getAgentTempDirectory() {
    const tempDirectory = tasks.getVariable("Agent.TempDirectory");
    if (!tempDirectory) {
        throw new Error("Agent.TempDirectory is not set");
    }
    return tempDirectory;
}

export { resolvePublishedOctoVersion, getOrDownloadOcto, addToolToPath, getEmbeddedOcto };
