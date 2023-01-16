import commandLineArgs from "command-line-args";
import shlex from "shlex";

describe("cli args", () => {
    test("simple args", async () => {
        const optionDefs = [{ name: "variable", type: String, multiple: false }];

        const options = commandLineArgs(optionDefs, { argv: ["--variable", "value"] });
        expect(options.variable).toBe("value");
    });

    test("simple args with alias", async () => {
        const optionDefs = [{ name: "variable", alias: "v", type: String, multiple: false }];

        const options = commandLineArgs(optionDefs, { argv: ["-v", "value"] });
        expect(options.variable).toBe("value");
    });

    test("simple args with alias 2", async () => {
        const optionDefs = [{ name: "variable", alias: "v", type: String, multiple: false }];

        const options = commandLineArgs(optionDefs, { argv: ["-v", '"value with space"'] });
        expect(options.variable).toBe('"value with space"');
    });

    test("basic split on space", async () => {
        const optionDefs = [{ name: "variable", alias: "v", type: String, multiple: true }];
        const args = "--variable value1 --variable value2 -v value3";
        const splitArgs = shlex.split(args);
        const options = commandLineArgs(optionDefs, { argv: splitArgs });
        console.log(options);
        expect(options.variable).toStrictEqual(["value1", "value2", "value3"]);
    });

    test("split on space with quoted values", async () => {
        const optionDefs = [{ name: "variable", alias: "v", type: String, multiple: true }];
        const args = '--variable value1 --variable "value 2" -v value3';
        const splitArgs = shlex.split(args);
        const options = commandLineArgs(optionDefs, { argv: splitArgs });
        console.log(options);
        expect(options.variable).toStrictEqual(["value1", "value 2", "value3"]);
    });

    test("split on space with quoted values", async () => {
        const optionDefs = [{ name: "variable", alias: "v", type: String, multiple: true }];
        const args = "--variable value1 --variable 'value 2' -v value3";
        const splitArgs = shlex.split(args);
        const options = commandLineArgs(optionDefs, { argv: splitArgs });
        console.log(options);
        expect(options.variable).toStrictEqual(["value1", "value 2", "value3"]);
    });
});
