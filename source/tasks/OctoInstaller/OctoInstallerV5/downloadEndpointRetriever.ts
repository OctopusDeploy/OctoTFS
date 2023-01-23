import * as tasks from "azure-pipelines-task-lib/task";
import { IProxyConfiguration } from "typed-rest-client/Interfaces";
import * as TypedRestClient from "typed-rest-client";
import os from "os";
import { OctopusCLIVersionFetcher } from "./octopusCLIVersionFetcher";

interface LatestResponse {
    latest: string;
    downloads: DownloadOption[];
}

interface VersionsResponse {
    versions: string[];
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

export interface Endpoint {
    downloadUrl: string | undefined;
    version: string;
}

export class DownloadEndpointRetriever {
    private osPlat: string = os.platform();

    constructor(readonly octopurlsUrl: string) {}

    public async getEndpoint(versionSpec: string): Promise<Endpoint> {
        const octopurls = this.restClient();

        const versionsResponse = await octopurls.get<VersionsResponse>("OctopusCLIVersions");
        if (versionsResponse.result === null || versionsResponse.result === undefined) {
            throw Error(`Failed to resolve Octopus CLI versions. Endpoint returned ${versionsResponse.statusCode} status code.`);
        }

        const version = new OctopusCLIVersionFetcher(versionsResponse.result.versions).getVersion(versionSpec);

        tasks.debug(`Attempting to contact ${this.octopurlsUrl} to find Octopus CLI tool version ${version}`);

        const response = await octopurls.get<LatestResponse>("LatestTools");

        if (response.result === null || response.result === undefined) {
            throw Error(`Failed to resolve Octopus CLI tool version ${version}. Endpoint returned ${response.statusCode} status code.`);
        }

        let platform = "linux";
        switch (this.osPlat) {
            case "darwin":
                platform = "osx";
                break;
            case "win32":
                platform = "win";
                break;
        }

        let downloadUrl: string | undefined;

        for (const download of response.result.downloads) {
            if (download.platform === platform) {
                const result = { ...download, version };
                downloadUrl = this.applyTemplate(result, download.template);
            }
        }

        return { downloadUrl, version };
    }

    private restClient() {
        const proxyConfiguration = tasks.getHttpProxyConfiguration(this.octopurlsUrl);
        let proxySettings: IProxyConfiguration | undefined = undefined;

        if (proxyConfiguration) {
            tasks.debug(
                "Using agent configured proxy. If this command should not be sent via the agent's proxy, you might need to add or modify the agent's .proxybypass file. See https://docs.microsoft.com/en-us/azure/devops/pipelines/agents/proxy#specify-proxy-bypass-urls."
            );
            proxySettings = {
                proxyUrl: proxyConfiguration.proxyUrl,
                proxyUsername: proxyConfiguration.proxyUsername,
                proxyPassword: proxyConfiguration.proxyPassword,
                proxyBypassHosts: proxyConfiguration.proxyBypassHosts,
            };
        }

        return new TypedRestClient.RestClient("OctoTFS/Tasks", this.octopurlsUrl, undefined, { proxy: proxySettings });
    }

    private applyTemplate(dictionary: Dictionary, template: string) {
        return Object.keys(dictionary).reduce((result, key) => result.replace(new RegExp(`{${key}}`, "g"), dictionary[key] ? String(dictionary[key]) : ""), template);
    }
}
