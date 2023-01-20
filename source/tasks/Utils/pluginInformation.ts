function getPluginAndVersionInformation() {
    return `plugin/${process.env.EXTENSION_VERSION}`;
}

export function getUserAgentApp(stepNoun: string, stepVerb: string, stepVersion: number): string {
    return `${getPluginAndVersionInformation()} (${stepNoun};${stepVerb};v${stepVersion})`;
}
