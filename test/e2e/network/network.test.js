"use strict";

const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");

const run = promisify(execFile);
const fixtureDir = path.join(__dirname, "fixture-project");
const testplaneBin = path.resolve(__dirname, "../../../bin/testplane");

describe("network recording e2e", function () {
    this.timeout(180000);

    const server = http.createServer(async (request, response) => {
        if (request.url === "/redirect") {
            response.writeHead(307, { location: "/echo" }).end();
        } else if (request.url === "/echo") {
            let body = "";
            for await (const chunk of request.setEncoding("utf8")) {
                body += chunk;
            }
            response.setHeader("Set-Cookie", ["first=1", "second=2"]);
            response.end(`received ${body}`);
        } else {
            response.setHeader("Content-Type", "text/html");
            response.end("<!doctype html><title>Network fixture</title>");
        }
    });

    before(async () => {
        server.listen(0, "127.0.0.1");
        await once(server, "listening");
    });

    after(async () => {
        await server[Symbol.asyncDispose]();
    });

    async function runFixture(browser, network) {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "testplane-network-e2e-"));
        const output = path.join(tempDir, "events.json");
        try {
            await run(process.execPath, [testplaneBin, "--browser", browser], {
                cwd: fixtureDir,
                env: {
                    ...process.env,
                    NETWORK_E2E_URL: `http://127.0.0.1:${server.address().port}`,
                    NETWORK_E2E_ENABLED: String(network),
                    NETWORK_E2E_OUTPUT: output,
                },
                timeout: 150000,
            });
            const events = JSON.parse(await fs.readFile(output, "utf8"));
            assert.deepEqual(events.passes, ["sends a request"]);
            return events;
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    }

    it("records redirects, headers and bodies in Chrome", async () => {
        const { network } = await runFixture("chrome", true);
        assert.deepEqual(
            network.map(event => event.context),
            [{ testPath: ["sends a request"], browserId: "chrome" }],
        );

        const { requests } = network[0];
        assert.deepEqual(
            requests.map(request => [new URL(request.url).pathname, request.response?.status]),
            [
                ["/redirect", 307],
                ["/echo", 200],
            ],
        );

        const echo = requests[1];
        assert.equal(echo.body, "fixture payload");
        assert.equal(echo.response.body, "received fixture payload");
        assert.deepEqual(
            echo.response.headers
                .filter(header => header.name.toLowerCase() === "set-cookie")
                .map(header => header.value),
            ["first=1", "second=2"],
        );
    });

    it("keeps DOM snapshots and omits network events by default in Chrome", async () => {
        const { network, domSnapshots } = await runFixture("chrome", false);
        assert.deepEqual(network, []);
        assert.ok(domSnapshots > 0);
    });

    it("passes without network events when CDP is unavailable in Firefox", async () => {
        const { network } = await runFixture("firefox", true);
        assert.deepEqual(network, []);
    });
});
