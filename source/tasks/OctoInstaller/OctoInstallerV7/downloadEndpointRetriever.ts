import * as tasks from "azure-pipelines-task-lib/task";
import * as TypedRestClient from "typed-rest-client";
import { IProxyConfiguration } from "typed-rest-client/Interfaces";
import { OctopusCLIVersionResolver } from "./octopusCLIVersionResolver";
import { Logger } from "@octopusdeploy/api-client";

const downloadsRegEx =
    /^.*_(?<version>(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?)_(?<platform>linux|macOS|windows)_(?<architecture>arm64|amd64).(?<extension>tar.gz|zip)$/i;

type DownloadOption = {
    version: string;
    location: string;
    extension: string;
    platform?: string;
    architecture?: string;
};

export interface Endpoint {
    downloadUrl: string;
    version: string;
    architecture: string;
}

interface VersionsResponse {
    versions: string[];
    downloads: DownloadOption[];
}

interface GitHubRelease {
    tag_name: string;
    assets: GitHubReleaseAsset[];
}

interface GitHubReleaseAsset {
    version: string;
    name: string;
    browser_download_url: string;
}

export class DownloadEndpointRetriever {
    constructor(readonly releasesUrl: string, readonly osPlatform: string, readonly osArch: string, readonly logger: Logger) {}

    public async getEndpoint(versionSpec: string): Promise<Endpoint> {
        this.logger.debug?.(`Attempting to contact ${this.releasesUrl} to find Octopus CLI tool version ${versionSpec}`);

        const versionsResponse: VersionsResponse | null = await this.getVersions();
        if (versionsResponse === null) {
            throw Error(`Unable to get versions...`);
        }

        const version = new OctopusCLIVersionResolver(versionsResponse.versions).getVersion(versionSpec);
        if (version === null) {
            throw Error(`The version specified (${version}) is not available to download.`);
        }

        this.logger.debug?.(`Attempting to find Octopus CLI version ${version}`);

        let platform = "linux";
        switch (this.osPlatform) {
            case "darwin":
                platform = "macOS";
                break;
            case "win32":
                platform = "windows";
                break;
        }

        let arch = "amd64";
        switch (this.osArch) {
            case "arm":
            case "arm64":
                arch = "arm64";
                break;
        }

        this.logger.debug?.(`Attempting download for platform '${platform}' and architecture ${this.osArch}`);

        let downloadUrl: string | undefined;

        for (const download of versionsResponse.downloads) {
            if (download.version === version && download.platform === platform && download.architecture === arch) {
                downloadUrl = download.location;
            }
        }

        if (downloadUrl === undefined || downloadUrl === null) {
            throw Error(`Failed to resolve endpoint URL to download: ${downloadUrl}`);
        }

        this.logger.debug?.(`Checking status of download url '${downloadUrl}'`);

        const http = this.restClient();
        const statusCode = (await http.client.head(downloadUrl)).message.statusCode;
        if (statusCode !== 200) {
            throw Error(`Octopus CLI version not found: ${version}`);
        }

        this.logger.info?.(`✓ Octopus CLI version found: ${version}`);
        return { downloadUrl, version, architecture: arch };
    }

    async getVersions(): Promise<VersionsResponse | null> {
        const githubReleasesClient = this.restClient();

        const releasesResponse = (await githubReleasesClient.get<GitHubRelease[]>(this.releasesUrl)).result;
        if (releasesResponse === null) {
            return null;
        }

        const ext: string = this.osPlatform === "win32" ? "zip" : "tar.gz";

        const downloads = releasesResponse.flatMap((v) =>
            v.assets
                .filter((a) => downloadsRegEx.test(a.name))
                .map((a) => {
                    const matches = downloadsRegEx.exec(a.name);

                    return {
                        version: matches?.groups?.version || v.tag_name.slice(1),
                        location: a.browser_download_url,
                        extension: matches?.groups?.extension || `.${ext}`,
                        platform: matches?.groups?.platform || undefined,
                        architecture: matches?.groups?.architecture || undefined,
                    };
                })
        );
        const versions = downloads.map((d) => d.version);
        return {
            versions,
            downloads,
        };
    }

    private restClient() {
        const proxyConfiguration = tasks.getHttpProxyConfiguration(this.releasesUrl);
        let proxySettings: IProxyConfiguration | undefined = undefined;

        if (proxyConfiguration) {
            this.logger.debug?.(
                "Using agent configured proxy. If this command should not be sent via the agent's proxy, you might need to add or modify the agent's .proxybypass file. See https://docs.microsoft.com/en-us/azure/devops/pipelines/agents/proxy#specify-proxy-bypass-urls."
            );
            proxySettings = {
                proxyUrl: proxyConfiguration.proxyUrl,
                proxyUsername: proxyConfiguration.proxyUsername,
                proxyPassword: proxyConfiguration.proxyPassword,
                proxyBypassHosts: proxyConfiguration.proxyBypassHosts,
            };
        }

        return new TypedRestClient.RestClient("OctoTFS/Tasks", this.releasesUrl, undefined, { proxy: proxySettings });
    }
}
