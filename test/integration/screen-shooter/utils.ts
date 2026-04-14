import http from "node:http";
import getPort from "get-port";
import path from "node:path";
import fs from "node:fs";
const FIXTURES_DIR = path.join(__dirname, "fixtures");

export const closeServer = (server: http.Server): Promise<void> =>
    new Promise((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
    });

export const startFixtureServer = async (): Promise<{ server: http.Server; pageUrl: string }> => {
    const port = await getPort();
    const server = http.createServer(async (req, res) => {
        const requestUrl = req.url ?? "/";
        const pathname = new URL(requestUrl, "http://127.0.0.1").pathname;
        const fixtureName =
            pathname === "/" || pathname === "/index.html" ? "partially-offscreen.html" : path.basename(pathname);
        const fixturePath = path.join(FIXTURES_DIR, fixtureName);

        if (!fixturePath.startsWith(FIXTURES_DIR)) {
            res.writeHead(404);
            res.end("Not found");
            return;
        }

        try {
            const fixtureHtml = await fs.promises.readFile(fixturePath, "utf8");
            res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
            res.end(fixtureHtml);
        } catch {
            res.writeHead(404);
            res.end("Not found");
        }
    });

    await new Promise<void>((resolve, reject) => {
        const onError = (error: Error): void => reject(error);
        server.once("error", onError);
        server.listen(port, "127.0.0.1", () => {
            server.off("error", onError);
            resolve();
        });
    });

    return { server, pageUrl: `http://127.0.0.1:${port}` };
};
