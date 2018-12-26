import * as glob from "glob";
import * as path from "path";
import { Configuration, DefinePlugin } from "webpack";
let nodeExternals = require("webpack-node-externals");
let paths = require("./build/paths");

const resolveTasks = (): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        glob(`${paths.sourceRoot}tasks/**/index.ts`, (err, matches) => {
            if(err){
                reject(err);
            }
            resolve(matches);
        });
    })
};

const createTaskConfig = (filePath: string): Configuration => {
    const outFolder =  path.resolve(`${paths.outputPath}tasks/${path.basename(path.dirname(filePath))}`);

    return {
        target: "node",
        node:{
            __dirname: false,
            __filename: false
        },
        context: path.resolve(paths.sourceRoot),
        entry: path.resolve(filePath),
        plugins: [
            new DefinePlugin({
                'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
                'process.env.EXTENSION_VERSION': JSON.stringify(process.env.EXTENSION_VERSION)
            }),
        ],
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/
                }
            ]
        },
        externals: [nodeExternals()],
        resolve: {
            plugins: [],
            extensions: [ ".tsx", ".ts", ".js" ]
        },
        output:{
            filename: 'index.js',
            path: path.resolve(outFolder),
        }
    }
}

export default Promise.all([
    resolveTasks()
]).then(([tasks]) => {
    const result =  [
        ...tasks.map(createTaskConfig)
    ];
    return result;
})

