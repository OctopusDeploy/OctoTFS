import * as tasks from "azure-pipelines-task-lib/task";

export interface OctoServerConnectionDetails {
    url: string;
    apiKey: string;
    ignoreSslErrors: boolean;
}

export const DefaultOctoConnectionInputName = "OctoConnectedServiceName";

export function getDefaultOctopusConnectionDetailsOrThrow() {
    const connection = tasks.getInput(DefaultOctoConnectionInputName, false);

    if (connection) {
        const result = getOctopusConnectionDetails(connection);
        if (!result) {
            throw new Error("Could not retrieve default Octo connection information");
        }

        return result;
    }

    if (process.env.OCTOPUS_API_KEY && process.env.OCTOPUS_SERVER) {
        return {
            url: process.env.OCTOPUS_SERVER,
            apiKey: process.env.OCTOPUS_API_KEY,
            ignoreSslErrors: process.env.OCTOPUS_IGNORE_SSL ? process.env.OCTOPUS_IGNORE_SSL === "true" : false,
        };
    }

    throw new Error("Could not retrieve default Octo connection information");
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
