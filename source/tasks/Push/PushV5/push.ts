import { OctoServerConnectionDetails } from "../../Utils/connection";
import { ReplaceOverwriteMode } from "../../Utils/inputs";
import { executeTask } from "../../Utils/octopusTasks";
import glob from "glob";
import { OctopusToolRunner } from "../../Utils/tool";

export class Push {
    constructor(readonly tool: OctopusToolRunner, readonly connection: OctoServerConnectionDetails) {}

    public async run(space: string, packages: string[], overwriteMode: ReplaceOverwriteMode, additionalArguments?: string | undefined) {
        const matchedPackages = await this.resolveGlobs(packages);

        this.tool.arg("push");
        this.tool.arg(["--space", space]);
        this.tool.arg(["--overwrite-mode", overwriteMode]);
        this.tool.arg("--enableServiceMessages");
        for (const item of matchedPackages) {
            this.tool.arg(["--package", item]);
        }

        await executeTask(this.tool, "(package;push;v5)", this.connection, "Package(s) pushed.", "Failed to push package(s).", additionalArguments);
    }

    private resolveGlobs = async (globs: string[]): Promise<string[]> => {
        const globResults = await Promise.all(globs.map(this.pGlobNoNull));
        const results = ([] as string[]).concat(...globResults);

        return results;
    };

    private pGlobNoNull = (pattern: string): Promise<string[]> => {
        return new Promise((resolve, reject) => {
            glob(pattern, { nonull: true }, (err, matches) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(matches);
            });
        });
    };
}
