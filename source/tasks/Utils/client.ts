import { Client, ClientConfiguration, Logger } from "@octopusdeploy/api-client";
import { getUserAgentApp } from "./pluginInformation";
import https from "https";
import { OctoServerConnectionDetails } from "./connection";

export async function getClient(connection: OctoServerConnectionDetails, logger: Logger, stepNoun: string, stepVerb: string, stepVersion: number) {
    const config: ClientConfiguration = {
        userAgentApp: getUserAgentApp(stepNoun, stepVerb, stepVersion),
        instanceURL: connection.url,
        apiKey: connection.apiKey,
        logging: logger,
    };
    if (connection.ignoreSslErrors) {
        config.httpsAgent = new https.Agent({ rejectUnauthorized: false });
    }

    return await Client.create(config);
}
