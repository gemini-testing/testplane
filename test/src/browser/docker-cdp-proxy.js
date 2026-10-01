"use strict";

const http = require("node:http");
const { once } = require("node:events");
const { spawn } = require("node:child_process");
const { WebSocket, WebSocketServer } = require("ws");
const { CDP_PROXY_SCRIPT } = require("src/browser/docker-cdp-proxy");

describe("Docker CDP proxy", () => {
    it("should discover the browser WebSocket and relay CDP through the Selenoid root path", async function () {
        this.timeout(10000); // Allow for a cold Python interpreter startup on the host.
        let upgradePath;
        let upgradeOrigin;
        const protocol = { domains: [{ domain: "Target" }] };
        const chrome = http.createServer((req, res) => {
            res.setHeader("content-type", "application/json");
            res.end(
                JSON.stringify(
                    req.url === "/json/version"
                        ? { webSocketDebuggerUrl: `ws://127.0.0.1:${chrome.address().port}/devtools/browser/real-id` }
                        : protocol,
                ),
            );
        });
        const wss = new WebSocketServer({ noServer: true });
        chrome.on("upgrade", (req, socket, head) => {
            upgradePath = req.url;
            upgradeOrigin = req.headers.origin;
            wss.handleUpgrade(req, socket, head, ws => {
                ws.on("message", data => {
                    const { id, method } = JSON.parse(data.toString());
                    ws.send(JSON.stringify({ id, result: { method, browserContextIds: [] } }));
                });
            });
        });
        let proxy;
        let client;
        try {
            chrome.listen(0, "127.0.0.1");
            await once(chrome, "listening");
            proxy = spawn("python3", ["-u", "-c", CDP_PROXY_SCRIPT, "127.0.0.1", String(chrome.address().port), "0"]);
            let errors = "";
            proxy.stderr.on("data", chunk => (errors += chunk));
            const port = await new Promise((resolve, reject) => {
                proxy.once("error", reject);
                proxy.once("exit", code => reject(new Error(`Python proxy exited: ${code}\n${errors}`)));
                proxy.stdout.once("data", chunk => resolve(Number(chunk.toString().trim())));
            });
            const response = await fetch(`http://127.0.0.1:${port}/json/protocol`);
            assert.deepEqual(await response.json(), protocol);

            client = new WebSocket(`ws://127.0.0.1:${port}/`, { origin: "http://external-host" });
            await once(client, "open");
            const message = once(client, "message");
            client.send(JSON.stringify({ id: 1, method: "Target.getBrowserContexts" }));
            assert.deepEqual(JSON.parse((await message)[0].toString()), {
                id: 1,
                result: { method: "Target.getBrowserContexts", browserContextIds: [] },
            });
            assert.equal(upgradePath, "/devtools/browser/real-id");
            assert.isUndefined(upgradeOrigin);

            const closed = once(client, "close");
            for (const ws of wss.clients) ws.terminate();
            await closed;
        } finally {
            client?.terminate();
            for (const ws of wss.clients) ws.terminate();
            wss.close();
            if (proxy && proxy.exitCode === null && proxy.signalCode === null) {
                const exited = once(proxy, "exit");
                proxy.kill();
                await exited;
            }
            chrome.closeAllConnections();
            chrome.close();
        }
    });
});
