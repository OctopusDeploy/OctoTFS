import * as tasks from "azure-pipelines-task-lib/task";
import { RestClient } from "typed-rest-client/RestClient";
import { getDefaultOctoConnectionInputValue } from "./inputs";
import { either } from "fp-ts";
import OctoApiKeyHandler from "./OctoApiKeyHandler";

export interface OctoServerConnectionDetails {
    url: string;
    apiKey: string;
    ignoreSslErrors: boolean;
}

export function getDefaultOctopusConnectionDetailsOrThrow() {
    let result = getDefaultOctoConnectionInputValue().map(getOctopusConnectionDetails).toNullable();
    if (!result) {
        throw new Error("Could not retrieve default Octo connection information");
    }
    return result;
}

export function getOctopusConnectionDetails(name: string): OctoServerConnectionDetails {
    const octoEndpointAuthorization = tasks.getEndpointAuthorization(name, false);
    const ignoreSSL = tasks.getEndpointDataParameter(name, "ignoreSslErrors", true);
    return {
        url: tasks.getEndpointUrl(name, false),
        apiKey: octoEndpointAuthorization.parameters["apitoken"],
        ignoreSslErrors: !!ignoreSSL && ignoreSSL.toLowerCase() === "true",
    };
}

export function fetchProjectName(details: OctoServerConnectionDetails, projectId: string) {
    console.log("Ignore SSL: " + details.ignoreSslErrors);
    const client = new RestClient("OctoTFS", details.url, [new OctoApiKeyHandler(details.apiKey)], { ignoreSslError: details.ignoreSslErrors });
    return client
        .get<{ Name: string }>(`api/projects/${projectId}`)
        .then((x) => {
            if (x.result) {
                return either.right<string, string>(x.result.Name);
            }

            return either.left<string, string>(`Could not resolve project name given id "${projectId}". Server returned status code: ${x.statusCode}`);
        })
        .catch((error) => either.left<string, string>(error));
}

export const isProjectId = (projectNameOrId: string) => /\w*Projects-\d*/.test(projectNameOrId);

export function resolveProjectName(connection: OctoServerConnectionDetails, projectNameOrId: string) {
    if (isProjectId(projectNameOrId)) {
        return fetchProjectName(connection, projectNameOrId);
    }

    return Promise.resolve(either.right<string, string>(projectNameOrId));
}
