import assert from "node:assert/strict";
import { preview } from "vite";

const server = await preview({ preview: { host: "127.0.0.1", port: 0 } });

try {
    const { port } = server.httpServer.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    const response = await fetch(baseUrl);

    assert.equal(response.status, 200, "The built application must serve index.html");

    const html = await response.text();
    assert.match(html, /id="root"/, "The application must have a React root");

    const script = html.match(/<script[^>]+src="([^"]+)"/);
    assert.ok(script, "The HTML must load the application bundle");
    assert.equal((await fetch(new URL(script[1], baseUrl))).status, 200);
} finally {
    await new Promise((resolve, reject) => server.httpServer.close(error => (error ? reject(error) : resolve())));
}
