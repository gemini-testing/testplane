import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import execa from "execa";

describe("failure limits integration", function () {
    // HTTP 429 retries use exponential backoff; two failed attempts take over a minute.
    this.timeout(120000);

    ["numeric", "filtered", "immediate"].forEach(mode => {
        it(`stops the CLI on HTTP 429 and cancels remaining tests in ${mode} mode`, async () => {
            const directory = await fs.mkdtemp(path.join(os.tmpdir(), "testplane-exit-on-error-"));
            let requests = 0;
            const server = http.createServer((_req, res) => {
                requests++;
                res.writeHead(429, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ value: { error: "session not created", message: "Too Many Requests" } }));
            });

            try {
                await new Promise<void>((resolve, reject) => {
                    server.once("error", reject);
                    server.listen(0, "127.0.0.1", resolve);
                });
                const { port } = server.address() as AddressInfo;
                const config = path.join(directory, "testplane.config.js");
                const tests = path.join(directory, "tests.js");
                await fs.cp(path.join(__dirname, "fixtures"), directory, { recursive: true });

                const result = await execa(
                    process.execPath,
                    [path.resolve("bin/testplane"), tests, "--config", config],
                    {
                        cwd: directory,
                        env: { ["testplane_grid_url"]: `http://127.0.0.1:${port}/`, TESTPLANE_FAILURE_MODE: mode },
                        reject: false,
                        timeout: 100000,
                    },
                );

                assert.equal(result.exitCode, 1, result.all || result.stderr);
                assert.equal(result.timedOut, false);
                const immediate = mode === "immediate";
                const limit = immediate ? 1 : 2;
                assert.match(
                    result.stderr,
                    immediate
                        ? /system.patternsOnReject matched pattern "quota"/
                        : /system.maxFailures reached its limit of 2 (matching errors|errors)/,
                );
                assert.equal((result.stderr.match(/Terminating on critical error:/g) || []).length, 1);
                const events = result.stdout.match(/EXIT_ON_ERROR_EVENTS:(.*)/);
                assert.ok(events, result.stdout);
                assert.deepEqual(JSON.parse(events[1]), { retries: limit - 1, failures: 4, errors: 1 });
                // Four HTTP attempts precede each test failure. The pool can start
                // one queued request before that failure reaches the runner and cancels it.
                assert.ok(
                    requests >= 4 * limit && requests <= 4 * limit + 1,
                    `unexpected number of HTTP requests: ${requests}`,
                );
            } finally {
                server.closeAllConnections();
                await new Promise<void>(resolve => server.close(() => resolve()));
                await fs.rm(directory, { recursive: true, force: true });
            }
        });
    });
});
