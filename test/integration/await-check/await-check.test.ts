import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { strict as assert } from "node:assert";
import stripAnsi from "strip-ansi";
import { createFixture, runCli } from "../../../scripts/await-check-fixture";

describe("missing-await preflight integration", function () {
    this.timeout(45000);
    const cli = path.resolve(__dirname, "../../../bin/testplane");
    let dir: string;
    let server: http.Server;
    let gridUrl: string;
    let sessions: number;

    beforeEach(async () => {
        dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "testplane-preflight-")));
        sessions = 0;
        server = http.createServer((req, res) => {
            if (req.method === "POST" && req.url?.endsWith("/session")) sessions++;
            res.writeHead(500, { "content-type": "application/json" });
            res.end(JSON.stringify({ value: { error: "unknown error", message: "No session expected" } }));
        });
        await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
        gridUrl = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`;
    });
    afterEach(async () => {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
        await fs.rm(dir, { recursive: true, force: true });
    });

    for (const extension of [".js", ".ts", ".tsx"]) {
        it(`should abort real CLI for ${extension} before any test, hook or session`, async () => {
            const fixture = await createFixture(dir, { extension, gridUrl });
            const result = await runCli(cli, dir, ["--config", fixture.config, ...fixture.files]);
            assert.equal(result.code, 1, result.output);
            assert.match(result.output, /TestPreflightError/);
            assert.match(result.output, /No tests were started/);
            assert.match(stripAnsi(result.output), /browser.assertView\("plane"\)/);
            assert.ok(result.output.includes(fixture.files[1] + ":8:5"), result.output);
            assert.equal(sessions, 0);
            await assert.rejects(fs.access(fixture.marker), { code: "ENOENT" });
        });
    }

    for (const body of [
        'const p = browser.assertView("plane");',
        'const p = browser.assertView("plane"); if (flag) await p;',
        '["a"].forEach(async name => { await browser.assertView(name); });',
    ]) {
        it(`should reject ${body} without executing callbacks`, async () => {
            const fixture = await createFixture(dir, { body, gridUrl });
            const result = await runCli(cli, dir, ["--config", fixture.config, ...fixture.files]);
            assert.equal(result.code, 1, result.output);
            assert.match(result.output, /TestPreflightError/);
            assert.equal(sessions, 0);
            await assert.rejects(fs.access(fixture.marker), { code: "ENOENT" });
        });
    }

    for (const options of [
        { body: 'const p = browser.assertView("plane"); await p;' },
        { body: 'return browser.assertView("plane");' },
        { body: 'await Promise.all(["a"].map(async name => browser.assertView(name)));' },
        { checkMissingAwait: false },
    ]) {
        it(`should reach RUNNER_START for ${JSON.stringify(options)}`, async () => {
            const fixture = await createFixture(dir, { ...options, checkpoint: true, gridUrl });
            const result = await runCli(cli, dir, ["--config", fixture.config, ...fixture.files]);
            assert.match(result.output, /PREFLIGHT_PASSED/, result.output);
            assert.doesNotMatch(result.output, /TestPreflightError/);
            assert.equal(sessions, 0);
        });
    }

    for (const testRunEnv of ["nodejs", "browser"] as const) {
        it(`should guard run(TestCollection) and report failed state during teardown in ${testRunEnv}`, async () => {
            const fixture = await createFixture(dir, { gridUrl });
            // Isolate Testplane's process-wide signal handlers and standalone-file registry.
            const result = await runCli(path.resolve(__dirname, "../../../scripts/await-check-api.js"), dir, [
                fixture.files[1],
                gridUrl,
                testRunEnv,
            ]);
            assert.equal(result.code, 0, result.output);
            assert.match(result.output, /API_PREFLIGHT_PASSED/);
            assert.equal(sessions, 0);
        });
    }
});
