"use strict";

const path = require("node:path");
const { Mocha } = require("mocha");
const Testplane = require("../../..").default;

async function main() {
    const files = process.argv.slice(2);
    const events = [];
    const testplane = await Testplane.create({
        browsers: { chrome: { desiredCapabilities: { browserName: "chrome" } } },
        system: {
            fileExtensions: [".js", ".mjs", ".cjs", ".ts"],
            mochaOpts: {
                ui(suite) {
                    Mocha.interfaces.bdd(suite);
                    suite.on("require", (_exports, file) => events.push(`require:${path.basename(file)}`));
                },
            },
        },
    });
    testplane.on("beforeFileRead", ({ file }) => events.push(`before:${path.basename(file)}`));
    testplane.on("afterFileRead", ({ file }) => events.push(`after:${path.basename(file)}`));

    const reads = [];
    for (let i = 0; i < 2; i++) {
        const collection = await testplane.readTests(files);
        const tests = collection.mapTests(test => [path.basename(test.file), test.title]);
        reads.push({ tests, events: events.splice(0) });
    }
    console.log(JSON.stringify(reads));
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
