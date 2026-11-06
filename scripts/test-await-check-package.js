"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { createFixture, runCli } = require("./await-check-fixture");
const exec = promisify(execFile);

async function main() {
    const root = path.resolve(__dirname, "..");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "testplane-package-preflight-"));
    try {
        // npm versions may mix lifecycle output into --json. Run the lifecycle explicitly first.
        await exec("npm", ["run", "prepack"], { cwd: root, maxBuffer: 10 * 1024 * 1024 });
        const pack = await exec("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", dir], {
            cwd: root,
            maxBuffer: 10 * 1024 * 1024,
        });
        const tarball = path.join(dir, JSON.parse(pack.stdout)[0].filename);
        const consumer = path.join(dir, "consumer");
        await fs.mkdir(consumer);
        await fs.writeFile(
            path.join(consumer, "package.json"),
            JSON.stringify({ name: "preflight-consumer", version: "1.0.0", private: true }),
        );
        await exec(
            "npm",
            [
                "install",
                tarball,
                "--omit=dev",
                "--ignore-scripts",
                "--no-fund",
                "--no-audit",
                "--fetch-retries=0",
                "--fetch-timeout=30000",
            ],
            { cwd: consumer, timeout: 180000, maxBuffer: 10 * 1024 * 1024 },
        );
        const installed = path.join(consumer, "node_modules/testplane");
        const pkg = JSON.parse(await fs.readFile(path.join(installed, "package.json"), "utf8"));
        assert.equal(pkg.dependencies.typescript, "5.3.2");
        assert.equal(pkg.devDependencies.typescript, undefined);
        await exec("npm", ["ls", "--omit=dev", "typescript"], { cwd: consumer });
        for (const extension of [".js", ".ts"]) {
            const fixture = await createFixture(consumer, { extension });
            const result = await runCli(path.join(installed, "bin/testplane"), consumer, [
                "--config",
                fixture.config,
                ...fixture.files,
            ]);
            assert.equal(result.code, 1, result.output);
            assert.match(result.output, /TestPreflightError/);
            assert.match(result.output, /No tests were started/);
            await assert.rejects(fs.access(fixture.marker), { code: "ENOENT" });
        }
        console.log("Published-package JS/TS preflight passed without consumer dev dependencies.");
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
