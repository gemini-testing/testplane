"use strict";

const execa = require("execa");
const fs = require("fs-extra");
const os = require("node:os");
const path = require("node:path");

describe("reading JavaScript modules", () => {
    const runner = path.resolve(__dirname, "../../fixtures/test-reader/read-modules.cjs");
    let directory;

    const runReader = (files, env) =>
        execa.node(runner, files, {
            cwd: directory,
            nodeOptions: [],
            env: { TS_ENABLE: undefined, TS_NODE_SWC: undefined, ...env },
        });

    before(async () => {
        directory = await fs.mkdtemp(path.join(os.tmpdir(), "testplane modules #"));
        await fs.writeJson(path.join(directory, "package.json"), {
            name: "read-modules-fixture",
            type: "module",
            exports: { import: "./import.mjs", require: "./require.cjs" },
        });

        const esm = [
            'import condition from "read-modules-fixture";',
            'import { basename } from "node:path";',
            'import { fileURLToPath } from "node:url";',
            "const file = import.meta.url && basename(fileURLToPath(import.meta.url));",
            'it(file + ":" + condition, () => {});',
        ].join("\n");
        await Promise.all(["commonjs", "typeless"].map(dir => fs.ensureDir(path.join(directory, dir))));
        await Promise.all(
            Object.entries({
                "import.mjs": 'export default "import";',
                "require.cjs": 'module.exports = "require";',
                "native.js": esm,
                "native.mjs": esm,
                "common.cjs": 'it(require("read-modules-fixture"), () => {});',
                "commonjs/package.json": '{"type":"commonjs"}',
                "commonjs/plain.js": 'it("CommonJS " + typeof require, () => {});',
                "typeless/package.json": "{}",
                "typeless/shebang.js": '#!/usr/bin/env node\nit("shebang CommonJS " + typeof require, () => {});',
                "typeless/detected.js": 'it(import.meta.url ? "detected ESM" : "not ESM", () => {});',
                "typeless/transpiled.js": 'import title from "./helper"; it(title, () => {});',
                "typeless/helper.js": 'module.exports = "transpiled JS";',
                "helper.js": 'export default "extensionless";',
                "extensionless.js": 'import title from "./helper"; it(title, () => {});',
                "style.css": "body { color: red; }",
                "asset.js": 'import "./style.css"; it("CSS hook", () => {});',
                "dynamic-helper.js":
                    'import fs from "node:fs"; fs.appendFileSync("dynamic-helper.runs", "x"); await import("./helper");',
                "dynamic-asset.js":
                    'import fs from "node:fs"; fs.appendFileSync("dynamic-asset.runs", "x"); await import("./style.css");',
                "user-error.js":
                    'import fs from "node:fs"; fs.appendFileSync("user-error.runs", "x"); ' +
                    'throw Object.assign(new Error("user failure"), { code: "ERR_MODULE_NOT_FOUND", ' +
                    'url: new URL("./helper", import.meta.url).href });',
                "missing.js": 'import "./missing-dependency";',
                "typed.ts": 'const name: string = "TypeScript"; it(name, () => {});',
            }).map(([name, source]) => fs.writeFile(path.join(directory, name), source)),
        );
    });

    after(() => fs.remove(directory));

    for (const [mode, env] of [
        ["default transforms", {}],
        ["esbuild", { TS_NODE_SWC: "false" }],
        ["no transforms", { TS_ENABLE: "false" }],
    ]) {
        it(`should read native ESM twice alongside CommonJS with ${mode}`, async function () {
            this.timeout(10000);
            const cases = [
                ["native.js", "native.js:import"],
                ["common.cjs", "require"],
                ["native.mjs", "native.mjs:import"],
                [path.join("commonjs", "plain.js"), "CommonJS function"],
                [path.join("typeless", "detected.js"), "detected ESM"],
                [path.join("typeless", "shebang.js"), "shebang CommonJS function"],
            ];
            if (mode !== "no transforms") {
                cases.push(["typed.ts", "TypeScript"], [path.join("typeless", "transpiled.js"), "transpiled JS"]);
            }
            const files = cases.map(([name]) => name);
            const { stdout } = await runReader(files, env);
            const reads = JSON.parse(stdout);

            assert.lengthOf(reads, 2);
            for (const { tests, events } of reads) {
                assert.deepEqual(
                    tests,
                    cases.map(([file, title]) => [path.basename(file), title]),
                );
                assert.deepEqual(
                    events,
                    files.flatMap(file =>
                        ["before", "require", "after"].map(event => event + ":" + path.basename(file)),
                    ),
                );
            }
        });
    }

    for (const [file, title] of [
        ["extensionless.js", "extensionless"],
        ["asset.js", "CSS hook"],
    ]) {
        it(`should allow the CommonJS transform hook to link ${file} in an ESM package`, async function () {
            this.timeout(10000);
            for (const env of [{}, { TS_NODE_SWC: "false" }]) {
                const { stdout } = await runReader([file], env);
                assert.deepEqual(
                    JSON.parse(stdout).map(read => read.tests),
                    [[[file, title]], [[file, title]]],
                );
            }
        });
    }

    for (const [name, error] of [
        ["dynamic-helper", "ERR_MODULE_NOT_FOUND"],
        ["dynamic-asset", "ERR_UNKNOWN_FILE_EXTENSION"],
        ["user-error", "user failure"],
    ]) {
        it(`should preserve the original error without re-evaluating ${name}`, async function () {
            this.timeout(10000);
            const failure = await assert.isRejected(runReader([`${name}.js`]));
            assert.include(failure.stderr, error);
            assert.equal(await fs.readFile(path.join(directory, `${name}.runs`), "utf8"), "x");
        });
    }

    it("should preserve the native error when neither loader can resolve a static dependency", async function () {
        this.timeout(10000);
        const failure = await assert.isRejected(runReader(["missing.js"]));
        assert.include(failure.stderr, "ERR_MODULE_NOT_FOUND");
    });
});
