var gulp = require("gulp");
var path = require("path");
var run = require("gulp-run-command").default;
var clean = require("gulp-clean");
var runSequence = require("run-sequence");
var paths = require("../paths");
var glob = require("glob");
const argv = require('yargs').argv

gulp.task("build", (callback) => {
    return runSequence("clean", ["build:tasks", "build:widgets", "build:copy", "build:copy:task:content"], callback);
});

gulp.task("build:tasks", [], run("./node_modules/.bin/webpack --mode=development --require ts-node/register --require tsconfig-paths/register", {
    env: {
        TS_NODE_PROJECT: "build/tsconfig-webpack.json",
        EXTENSION_VERSION: argv.extensionVersion
    }
}));

gulp.task("build:widgets", ["build:widget:source"], () =>
{
    return gulp.src("node_modules/vss-web-extension-sdk/lib/**/*.*",{ base: "node_modules/vss-web-extension-sdk" })
    .pipe(gulp.dest(`${paths.outputPath}widgets/ProjectStatus`));
});

gulp.task("build:widget:source", [], () => {
    return gulp.src(`${paths.sourceRoot}widgets/**/*`, {base: `${paths.sourceRoot}widgets`})
    .pipe(gulp.dest(`${paths.outputPath}widgets`));
});

gulp.task("build:copy", [], () => {
    return gulp.src([`${paths.sourceRoot}*.*`, `${paths.sourceRoot}img/**/*.*`], { base: `${paths.sourceRoot}`})
    .pipe(gulp.dest("dist"));
});

gulp.task("build:copy:task:content", ["build:tasks"], (cb) => {
    var stream = gulp.src(`${paths.sourceRoot}tasks/**/*.{json,png,svg,zip,gz}`, { base: paths.sourceRoot}).pipe(gulp.dest(paths.outputPath));
});

gulp.task("build:copy:externals", ["build:tasks"], (cb) => {
    var stream = gulp.src(paths.externals.map(x => `node_modules/${x}/**/*.*`), { base: "."});

    glob(`${paths.outputPath}/tasks/**/task.json`, (err, matches) => {
        if(err){
            cb(err);
            return;
        }
        console.log("Matches : " + matches.length);

        matches.forEach((task) => {
            var dir = path.basename(task);
            console.log(dir);
            stream = stream.pipe(gulp.dest(path.dirname(task)));
        })

        stream.on("end", cb);
    });
});

gulp.task("clean", [], () => {
    return gulp.src("dist", {read: false})
    .pipe(clean());
});
