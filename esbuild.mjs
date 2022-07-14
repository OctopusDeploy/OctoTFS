import { build } from "esbuild";
import copyStaticFiles from "esbuild-copy-static-files";
import glob from "glob";
import { sep } from "path";
import { statSync } from "fs";
import os from "os";
import yargs from "yargs";

let __dirname = new URL(".", import.meta.url).pathname;

if (os.platform() === "win32") {
    if (__dirname.startsWith("/")) {
        __dirname = __dirname.substring(1);
    }
}

function entryPoints() {
    function doReplacements(entries, source) {
        const matches = glob.sync(`${__dirname}source/${source}/**/index.ts`);

        for (let match of matches) {
            const key = match.replace(`${__dirname}source/${source}/`, "tasks/").replace(".ts", "");

            entries[key] = match;
        }
    }

    const entries = {};
    doReplacements(entries, "tasks");
    doReplacements(entries, "tasksLegacy");

    return entries;
}

const argv = yargs(process.argv).argv;

function noTSFiles(src) {
    if (src.endsWith(".ts")) {
        return false;
    }

    return true;
}

function noFolders(src) {
    const isDirectory = statSync(src).isDirectory();

    if (src.endsWith(`${sep}source`)) {
        return true;
    }

    return !isDirectory;
}

const bundleAsMuchAsWeCan = {
    name: "my-special-bundle",
    setup(build) {
        build.onResolve({ filter: /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/ }, (args) => {
            console.log(args.path);
            console.log(`args.resolveDir=${args.resolveDir}`);
            if (args.path.startsWith("azure-pipelines-tool-lib") || args.path.startsWith("azure-pipelines-task-lib")) return { path: args.path, external: true };
        });
    },
};

build({
    entryPoints: entryPoints(),
    bundle: true,
    target: "es2018",
    platform: "node",
    outdir: "dist",
    metafile: true,
    minify: true,
    plugins: [
        copyStaticFiles({ src: "./source/img", dest: "dist/img" }),
        copyStaticFiles({ src: "./source", dest: "dist", recursive: false, filter: noFolders }),
        copyStaticFiles({ src: "./source/widgets", dest: "dist/widgets" }),
        copyStaticFiles({ src: "./node_modules/vss-web-extension-sdk/lib", dest: "dist/widgets/ProjectStatus/lib" }),
        copyStaticFiles({ src: "./source/tasks", dest: "dist/tasks", filter: noTSFiles }),
        copyStaticFiles({ src: "./source/tasksLegacy", dest: "dist/tasks", filter: noTSFiles }),
        bundleAsMuchAsWeCan,
    ],
    logLimit: 0,
    logLevel: "info",
    define: { "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV), "process.env.EXTENSION_VERSION": JSON.stringify(argv.extensionVersion) },
}).catch(() => process.exit(1));
