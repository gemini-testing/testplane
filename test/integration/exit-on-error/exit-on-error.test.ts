import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import execa from "execa";

describe("exitOnError integration", function () {
    this.timeout(60000);

    it("stops the CLI on a real HTTP 429 without test retries and cancels the remaining tests", async () => {
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

            const result = await execa(process.execPath, [path.resolve("bin/testplane"), tests, "--config", config], {
                cwd: directory,
                env: { ["testplane_grid_url"]: `http://127.0.0.1:${port}/` },
                reject: false,
                timeout: 45000,
            });

            assert.equal(result.exitCode, 1, result.all || result.stderr);
            assert.equal(result.timedOut, false);
            assert.match(result.stderr, /exitOnError rule "quota" reached its limit of 1 matching errors/);
            assert.equal((result.stderr.match(/Terminating on critical error:/g) || []).length, 1);
            const events = result.stdout.match(/EXIT_ON_ERROR_EVENTS:(.*)/);
            assert.ok(events, result.stdout);
            assert.deepEqual(JSON.parse(events[1]), { retries: 0, failures: 4, errors: 1 });
            // Four HTTP attempts precede the first test failure. The pool can start
            // one queued request before that failure reaches the runner and cancels it.
            assert.ok(requests >= 4 && requests <= 5, `unexpected number of HTTP requests: ${requests}`);
        } finally {
            server.closeAllConnections();
            await new Promise<void>(resolve => server.close(() => resolve()));
            await fs.rm(directory, { recursive: true, force: true });
        }
    });
});
