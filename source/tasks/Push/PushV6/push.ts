import { ReplaceOverwriteMode } from "../../Utils/inputs";
import { Client, OverwriteMode, PackageRepository } from "@octopusdeploy/api-client";
import glob from "glob";

export class Push {
    constructor(readonly client: Client) {}

    public async run(spaceName: string, packages: string[], overwriteMode: ReplaceOverwriteMode) {
        const matchedPackages = await this.resolveGlobs(packages);

        let mappedOverwriteMode = OverwriteMode.FailIfExists;
        if (overwriteMode === ReplaceOverwriteMode.true) {
            mappedOverwriteMode = OverwriteMode.OverwriteExisting;
        } else if (overwriteMode === ReplaceOverwriteMode.IgnoreIfExists) {
            mappedOverwriteMode = OverwriteMode.IgnoreIfExists;
        }

        const repository = new PackageRepository(this.client, spaceName);
        await repository.push(matchedPackages, mappedOverwriteMode);

        return packages;
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
