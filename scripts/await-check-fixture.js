"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const exec = promisify(execFile);

async function createFixture(
    dir,
    {
        extension = ".js",
        body = 'browser.assertView("plane");',
        checkMissingAwait = true,
        checkpoint = false,
        gridUrl = "http://127.0.0.1:1",
    } = {},
) {
    const marker = path.join(dir, "executed");
    const template = await fs.readFile(
        path.join(__dirname, "../test/fixtures/await-check/integration/test.fixture"),
        "utf8",
    );
    const makeSource = (title, content) =>
        template
            .replace("__MARKER__", () => JSON.stringify(marker))
            .replace("__TITLE__", () => JSON.stringify(title))
            .replace("__BODY__", () => content);
    const good = path.join(dir, "a-good.js");
    const bad = path.join(dir, "z-test" + extension);
    await fs.writeFile(good, makeSource("valid", 'await browser.assertView("valid");'));
    await fs.writeFile(bad, makeSource("checked", body));
    const config = path.join(dir, "testplane.config.js");
    const plugin = path.join(dir, "checkpoint.js");
    if (checkpoint) {
        await fs.writeFile(
            plugin,
            'module.exports = testplane => testplane.on(testplane.events.RUNNER_START, () => { throw new Error("PREFLIGHT_PASSED"); });\n',
        );
    }
    await fs.writeFile(
        config,
        "module.exports = " +
            JSON.stringify({
                gridUrl,
                system: { workers: 1, checkMissingAwait },
                browsers: {
                    chrome: { desiredCapabilities: { browserName: "chrome" } },
                    firefox: { desiredCapabilities: { browserName: "firefox" } },
                },
                plugins: checkpoint ? { [plugin]: true } : {},
            }) +
            ";\n",
    );
    return { config, files: [good, bad], marker };
}

async function runCli(cli, dir, args) {
    const flags = process.allowedNodeEnvironmentFlags.has("--no-experimental-strip-types")
        ? ["--no-experimental-strip-types"]
        : [];
    const options = {
        cwd: dir,
        timeout: 30000,
        maxBuffer: 5 * 1024 * 1024,
        env: { ...process.env, NODE_PATH: "", TS_NODE_SWC: "false" },
    };
    try {
        const result = await exec(process.execPath, [...flags, cli, ...args], options);
        return { code: 0, output: result.stdout + result.stderr };
    } catch (error) {
        if (typeof error.code !== "number") throw error;
        return { code: error.code, output: error.stdout + error.stderr };
    }
}

module.exports = { createFixture, runCli };
