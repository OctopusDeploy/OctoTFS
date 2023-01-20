function getPluginAndVersionInformation() {
    return `plugin/${process.env.EXTENSION_VERSION}`;
}

export function getUserAgentApp(stepNoun: string, stepVerb: string, stepVersion: number): Promise<string> {
    return `${await getPluginAndVersionInformation()} (${stepNoun};${stepVerb};v${stepVersion})`;
}
