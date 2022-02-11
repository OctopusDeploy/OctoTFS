var gulp = require("gulp");
var path = require("path");
var clean = require("gulp-clean");
var paths = require("../paths");
var glob = require("glob");
var spawn = require('child_process').spawn;
const argv = require('yargs').argv;

const sourceRoot =  path.resolve(paths.sourceRoot);
const outputPath = path.resolve(paths.outputPath);

gulp.task("build:tasks", () => {
    return spawn(path.join(sourceRoot, "../node_modules/.bin/webpack") + " --mode=development --require ts-node/register --require tsconfig-paths/register",
    {
        shell: true,
        stdio: 'inherit',
        env: {
            ...process.env,
            TS_NODE_PROJECT: "build/tsconfig-webpack.json",
            EXTENSION_VERSION: argv.extensionVersion
        }
    });
});

gulp.task("build:widget:source", () => {
    return gulp.src(path.join(sourceRoot, `widgets/**/*`), {base: path.join(sourceRoot, `widgets`) })
    .pipe(gulp.dest(path.join(outputPath, `widgets`)));
});

gulp.task("build:widgets", gulp.series(["build:widget:source"], () =>
{
    return gulp.src(
        path.join(sourceRoot, "../node_modules/vss-web-extension-sdk/lib/**/*.*"),
        { base: path.join(sourceRoot, "../node_modules/vss-web-extension-sdk") })
        .pipe(gulp.dest(path.join(outputPath, `widgets/ProjectStatus`)));
}));

gulp.task("build:copy", () => {
    return gulp.src([ path.join(sourceRoot, `*.*`), path.join(sourceRoot, `img/**/*.*`)], { base: sourceRoot })
    .pipe(gulp.dest(outputPath));
});

gulp.task("build:copy:task:content", () => {
    return gulp.src(path.join(path.resolve(sourceRoot), `tasks/**/*.{json,png,svg,zip,gz}`), { base: sourceRoot })
    .pipe(gulp.dest(outputPath));
});


gulp.task("build:copy:externals", (cb) => {
    var stream = gulp.src(paths.externals.map(x => `node_modules/${x}/**/*.*`), { base: "."});

    glob(path.join(outputPath, `tasks/**/task.json`), (err, matches) => {
        if(err){
            cb(err);
            return;
        }

        matches.forEach((task) => {
            stream = stream.pipe(gulp.dest(path.dirname(task)));
        });

        stream.on("end", cb);
    });

    return stream;
});

gulp.task("clean", () => {
    return gulp.src("dist", {read: false, allowEmpty: true})
    .pipe(clean());
});

gulp.task("build",
    gulp.series(
        "clean",
        "build:tasks",
        "build:widgets",
        "build:copy",
        "build:copy:task:content"
    )
);
