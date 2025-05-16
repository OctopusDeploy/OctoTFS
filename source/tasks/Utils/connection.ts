import * as tasks from "azure-pipelines-task-lib/task";

export interface OctoServerConnectionDetails {
    url: string;
    apiKey: string;
    ignoreSslErrors: boolean;
}

export const DefaultOctoConnectionInputName = "OctoConnectedServiceName";

export function getDefaultOctopusConnectionDetailsOrThrow() {
    const result = getOctopusConnectionDetails(tasks.getInput(DefaultOctoConnectionInputName, true) || "");
    if (!result) {
        throw new Error("Could not retrieve default Octo connection information");
    }
    return result;
}

function getOctopusConnectionDetails(name: string): OctoServerConnectionDetails {
    const octoEndpointAuthorization = tasks.getEndpointAuthorization(name, false);

    if (!octoEndpointAuthorization) {
        throw new Error(`Could not retrieve the endpoint authorization named ${name}.`);
    }

    const ignoreSSL = tasks.getEndpointDataParameter(name, "ignoreSslErrors", true);
    return {
        url: tasks.getEndpointUrl(name, false) || "",
        apiKey: octoEndpointAuthorization.parameters["apitoken"],
        ignoreSslErrors: !!ignoreSSL && ignoreSSL.toLowerCase() === "true",
    };
}

export function getDeepLink(baseUrl: string, path: string): string {
    if (baseUrl.endsWith("/")) {
        baseUrl = baseUrl.substring(0, baseUrl.length - 1);
    }
    return `${baseUrl}/app#/${path}`;
}
