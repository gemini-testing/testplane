"use strict";

const path = require("path");
const execa = require("execa");

const TESTPLANE_BIN = path.resolve(__dirname, "../../bin/testplane");
const PROJECTS_DIR = path.resolve(__dirname, "test-projects");
const MODULE_TYPE_WARNING = "MODULE_TYPELESS_PACKAGE_JSON";

const projects = [
    ["js-cjs", "js-cjs test"],
    ["js-esm", "js-esm test"],
    ["ts-cjs", "ts-cjs test"],
    ["ts-esm", "ts-esm test"],
];

describe("module loading", () => {
    projects.forEach(([projectName, testTitle]) => {
        it(`reads ${projectName}`, async () => {
            const { stdout, stderr } = await readTests(projectName);
            const tests = JSON.parse(stdout);

            assert.lengthOf(tests, 1);
            assert.deepEqual(tests[0].titlePath, [projectName, testTitle]);
            assert.deepEqual(tests[0].browserIds, ["chrome"]);
            assert.isFalse(tests[0].pending);
            assert.notInclude(stderr, MODULE_TYPE_WARNING);
        });
    });
});

function readTests(projectName) {
    return execa(
        process.execPath,
        [TESTPLANE_BIN, "list-tests", "-c", "testplane.config.cjs", "tests", "--formatter", "list"],
        {
            cwd: path.join(PROJECTS_DIR, projectName),
            env: {
                ...process.env,
                NODE_OPTIONS: [process.env.NODE_OPTIONS, "--trace-warnings"].filter(Boolean).join(" "),
            },
        },
    );
}
