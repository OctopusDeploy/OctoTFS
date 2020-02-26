import * as tasks from 'azure-pipelines-task-lib/task';
import { ToolRunner, IExecSyncResult } from 'azure-pipelines-task-lib/toolrunner';
import { OctoServerConnectionDetails } from "./connection";
import { curry } from "ramda";
import { isNullOrWhitespace } from "./inputs";
import { Option, some, none } from "fp-ts/lib/Option"
import { Either, right, fromOption  } from "fp-ts/lib/Either";
import { getOrDownloadOcto, addToolToPath, resolvePublishedOctoVersion } from './install';

export const ToolName = "octo";
export const ToolNameBeforeV7 = "Octo";


export interface ArgFormatter{
    (name: string, value: string, tool: ToolRunner): ToolRunner;
}

function stringOption(value?: string): Option<string> {
    return isNullOrWhitespace(value) ? none : some(value);
}

export class OctoLauncher {
    runner: ToolRunner;

    constructor (runner: ToolRunner) {
        this.runner = runner;
    }

    private getExecOptions(): any {
        return { env: { "OCTOEXTENSION": process.env.EXTENSION_VERSION, ...process.env } };
    }

    public launchOcto(configurations: Array<(tool: ToolRunner) => ToolRunner>): Q.Promise<number> {
        configureTool(configurations)(this.runner);

        return this.runner.exec(this.getExecOptions());
    }

    public launchOctoSync(configurations: Array<(tool: ToolRunner) => ToolRunner>): IExecSyncResult {
        configureTool(configurations)(this.runner);

        return this.runner.execSync(this.getExecOptions());
    }
}

export async function getOrInstallOctoCommandRunner(command: string) : Promise<Either<string, OctoLauncher>>{
    //If we can't find octo then it hasn't been added as an installer task
    //or it hasn't been added to the path.
    let octo = getOctoCommandRunner(command);
    if (octo.isSome()){
        return right(new OctoLauncher(octo.value));
    }

    return resolvePublishedOctoVersion("latest")
    .then(getOrDownloadOcto)
    .catch(err => {
        tasks.error(err);
        throw Error("Unable to locate and download the latest Octopus CLI tool. To use the embedded copy"
            + " or another specific version, add the Octopus CLI installer task to the build pipeline"
            + " before this task.");
    })
    .then(addToolToPath)
    .then(() => getOctoCommandRunner(command).map(x => new OctoLauncher(x)))
    .then(fromOption("Unable to run the Octopus CLI tool."));
}

export function getOctoCommandRunner(command: string) : Option<ToolRunner> {
    const isWindows = /windows/i.test(tasks.osType());
    if (isWindows) {
        return stringOption(
            tasks.which(`${ToolName}`, false)
            || tasks.which(`${ToolNameBeforeV7}`, false))
            .map(tasks.tool)
            .map(x => x.arg(command));
    }

    return getPortableOctoCommandRunner(command);
}

export function getPortableOctoCommandRunner(command: string) : Option<ToolRunner>{
    const octo = stringOption(
        tasks.which(`${ToolName}.dll`, false)
        || tasks.which(`${ToolNameBeforeV7}.dll`, false));
    const dotnet = tasks.which("dotnet", false);

    if (isNullOrWhitespace(dotnet)){
        tasks.warning("DotNet core 2.0 runtime was not found and this task will most likely fail. Target an agent which has the appropriate capability or add a DotNet core installer task to the start of you build definition to fix this problem.")
    }

    const tool = tasks.tool(tasks.which("dotnet", true));

    var result =  octo.map(x => tool
        .arg(`${x}`)
        .arg(command)
    );

    return result;
}

export const assertOctoVersionAcceptsIds = async function (): Promise<void> {
    const octo = await getOrInstallOctoCommandRunner("version");
    const result = octo.map(x => x.launchOctoSync([]))
        .getOrElseL(x => { throw new Error(x); });

    const outputLastLine = result.stdout.trim().split(/\r?\n/).pop() || "";
    const [, major, minor, patch] = outputLastLine.trim().match(/^(\d+)\.(\d+)\.(\d+)\b/) || [0, 0, 0, 0];
    const compatible
        = `${major}.${minor}.${patch}` == "1.0.0" // allow dev versions
        || major > 6
        || (major == 6 && minor > 10)
        || (major == 6 && minor == 10 && patch >= 0);
    if (!compatible) {
        throw new Error("The Octopus CLI tool is too old to run this task. Please use version 6.10.0 or newer, or downgrade the task to version 3.*.");
    }
};

export const connectionArguments = curry(({ url, apiKey, ignoreSslErrors }: OctoServerConnectionDetails, tool: ToolRunner) => {
    let tr = tool
        .arg(`--server=${url}`)
        .arg(`--apiKey=${apiKey}`);
    if (ignoreSslErrors) {
        tr = tr.arg(`--ignoreSslErrors`);
    }
    return tr;
});

export const multiArgument = curry((arg: ArgFormatter, name: string, values: string[], tool: ToolRunner) => {
    values.forEach(value =>  arg(name, value, tool))
    return tool;
});

export const argument = curry((name: string, value: string | null | undefined, tool: ToolRunner) => {
    return tool.line(`--${name}=${value}`);
});

export const argumentEnquote = curry((name: string, value: string | null | undefined, tool: ToolRunner) => {
    return argument(name, `"${value}"`, tool);
});

export const includeArguments = curry((value: string, tool: ToolRunner) => {
    return tool.line(value);
});

export const configureTool = curry((configurations: Array<(tool: ToolRunner) => ToolRunner>, tool: ToolRunner) => {
    configurations.forEach(x => x(tool));
    return tool;
});

export const flag = curry((name: string, value: boolean, tool: ToolRunner) => {
    return value ? tool.arg(`--${name}`) : tool;
});

export const argumentIf = curry((predicate: (value: string | null | undefined) => boolean, arg: ArgFormatter, name: string, value: string | null | undefined, tool: ToolRunner) : ToolRunner => {
    if(predicate(value)){
        return arg(name, value || "", tool);
    }
    return tool;
});

export const argumentIfSet = argumentIf((val) => !isNullOrWhitespace(val));