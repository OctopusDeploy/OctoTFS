import * as tasks from "azure-pipelines-task-lib/task";
import { option } from "fp-ts";
import glob from "glob";
import { flatten } from "ramda";

export enum ReplaceOverwriteMode {
    false = "FailIfExists",
    true = "OverwriteExisting",
    IgnoreIfExists = "IgnoreIfExists",
}

export function getOverwriteModeFromReplaceInput(replace: string): ReplaceOverwriteMode {
    return ReplaceOverwriteMode[replace as keyof typeof ReplaceOverwriteMode] || ReplaceOverwriteMode.false;
}

export const DefaultOctoConnectionInputName = "OctoConnectedServiceName";

export const pGlobNoNull = (pattern: string): Promise<string[]> => {
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

export function isNullOrWhitespace(value: string | null | undefined): value is null | undefined {
    return !value || !/\S/.test(value);
}

export function safeTrim(value: string | null | undefined): string | null | undefined {
    return value ? value.trim() : value;
}

export function removeTrailingSlashes(value: string | null | undefined): string | null | undefined {
    return value ? value.replace(/[/\\]+(?=\s*)$/, "") : value;
}

export function getLineSeparatedItems(value: string): Array<string> {
    return value ? value.split(/[\r\n]+/g).map((x) => x.trim()) : [];
}

const getRequiredInput = (name: string) => {
    return option.fromNullable(tasks.getInput(name, true));
};

const splitComma = (x: string) => x.split(",").map((x) => x.trim());

const getOptionalInput = (name: string) => {
    return option.fromNullable(tasks.getInput(name, false));
};

export const getOptionalCsvInput = (name: string) => {
    return getOptionalInput(name).map(splitComma).getOrElse([]);
};

export const getRequiredCsvInput = (name: string) => {
    return getRequiredInput(name).map(splitComma).getOrElse([]);
};

export { getRequiredInput, getOptionalInput };

export function getDefaultOctoConnectionInputValue() {
    return getRequiredInput(DefaultOctoConnectionInputName);
}

export const resolveGlobs = (globs: string[]): Promise<string[]> => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return Promise.all(globs.map(pGlobNoNull)).then((x) => flatten<string>(x));
};
