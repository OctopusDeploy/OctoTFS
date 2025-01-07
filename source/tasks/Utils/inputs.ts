import * as tasks from "azure-pipelines-task-lib";
import { OctoServerConnectionDetails } from "./connection";
import { OctopusToolRunner } from "./tool";

export enum ReplaceOverwriteMode {
    false = "FailIfExists",
    true = "OverwriteExisting",
    IgnoreIfExists = "IgnoreIfExists",
}

export function getLineSeparatedItems(value: string): Array<string> {
    return value ? value.split(/[\r\n]+/g).map((x) => x.trim()) : [];
}

export function parseVariableString(input: string): [string, string] {
    let escapeNext = false;
    let colonIndex = -1;
    
    for (let i = 0; i < input.length; i++) {
        if (input[i] === '\\' && !escapeNext) {
            escapeNext = true;
            continue;
        }
        
        if (input[i] === ':' && !escapeNext) {
            colonIndex = i;
            break;
        }
        
        escapeNext = false;
    }
    
    if (colonIndex === -1) {
        throw new Error(`Invalid variable format. Expected 'name: value' but got '${input}'`);
    }
    
    const variableName = input.substring(0, colonIndex).replace(/\\:/g, ':').trim();
    const variableValue = input.substring(colonIndex + 1).trim();
    
    return [variableName, variableValue];
}

export function getOverwriteModeFromReplaceInput(replace: string): ReplaceOverwriteMode {
    return ReplaceOverwriteMode[replace as keyof typeof ReplaceOverwriteMode] || ReplaceOverwriteMode.false;
}

export function getDelimitedInput(name: string, required?: boolean | undefined) {
    return tasks.getDelimitedInput(name, ",", required).map((s) => s.trim());
}

export function getRequiredInput(name: string) {
    return tasks.getInput(name, true) || "";
}

export function connectionArguments({ url, apiKey, ignoreSslErrors }: OctoServerConnectionDetails, tool: OctopusToolRunner) {
    tool.arg(["--server", url]);
    tool.arg(["--apiKey", apiKey]);
    if (ignoreSslErrors) {
        tool.arg("--ignoreSslErrors");
    }
}

export function includeAdditionalArgumentsAndProxyConfig(url: string, additionalArgs: string | undefined, tool: OctopusToolRunner) {
    const proxyRegex = /-proxy=/;

    const proxyConfig = tasks.getHttpProxyConfiguration(url);

    if (proxyConfig) {
        if (additionalArgs && !proxyRegex.test(additionalArgs)) {
            console.log(
                "Using agent configured proxy. If this command should not be sent via the agent's proxy, you might need to add or modify the agent's .proxybypass file. See https://docs.microsoft.com/en-us/azure/devops/pipelines/agents/proxy#specify-proxy-bypass-urls."
            );
            tool.arg(["--proxy", proxyConfig.proxyUrl]);
            tool.argIf(proxyConfig.proxyUsername, ["--proxyUser", `${proxyConfig.proxyUsername}`]);
            tool.argIf(proxyConfig.proxyPassword, ["--proxyPass", `${proxyConfig.proxyPassword}`]);
        }
    }

    tool.line(additionalArgs || "");
}
