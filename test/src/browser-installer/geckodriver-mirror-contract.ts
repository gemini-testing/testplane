import { BrowserPlatform } from "@puppeteer/browsers";
import { execFile } from "child_process";
import fs from "fs-extra";
import http from "http";
import os from "os";
import path from "path";
import { promisify } from "util";
import type { AddressInfo } from "net";
import proxyquire from "proxyquire";
import sinon from "sinon";
import type { installLatestGeckoDriver as InstallLatestGeckoDriver } from "../../../src/browser-installer/firefox/driver";

const execFileAsync = promisify(execFile);

describe("browser-installer GeckoDriver mirror contract", () => {
    const sandbox = sinon.createSandbox();
    let tempDir: string;
    let server: http.Server;
    let mirror: string;
    let archive: Buffer;
    let metadataStatus: number;
    let archiveStatus: number;
    let installLatestGeckoDriver: typeof InstallLatestGeckoDriver;
    let upstreamDownloadStub: sinon.SinonStub;
    const requests: string[] = [];

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "testplane-geckodriver-mirror-"));
        await fs.writeFile(path.join(tempDir, "geckodriver"), "mirrored driver");
        const archivePath = path.join(tempDir, "driver.tar.gz");
        await execFileAsync("tar", ["-czf", archivePath, "-C", tempDir, "geckodriver"]);
        archive = await fs.readFile(archivePath);
        metadataStatus = 200;
        archiveStatus = 200;
        requests.length = 0;

        server = http.createServer((request, response) => {
            requests.push(request.url!);

            if (request.url === "/nested/geckodriver/Cargo.toml") {
                response.writeHead(metadataStatus);
                response.end('[package]\nversion = "0.37.1"\n');
            } else if (request.url === "/nested/geckodriver/v0.37.1/geckodriver-v0.37.1-linux64.tar.gz") {
                response.writeHead(archiveStatus);
                response.end(archive);
            } else {
                response.writeHead(404);
                response.end();
            }
        });
        await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
        mirror = `http://127.0.0.1:${(server.address() as AddressInfo).port}/nested/geckodriver`;
        const originalFetch = globalThis.fetch;
        sandbox.stub(globalThis, "fetch").callsFake((input, init) => {
            if (!String(input).startsWith(`${mirror}/`)) {
                throw new Error(`Unexpected upstream request: ${input}`);
            }

            return originalFetch(input, init);
        });
        upstreamDownloadStub = sandbox.stub().rejects(new Error("Unexpected upstream download"));
        installLatestGeckoDriver = proxyquire("../../../src/browser-installer/firefox/driver", {
            geckodriver: { download: upstreamDownloadStub },
            "../utils": {
                getBrowserPlatform: () => BrowserPlatform.LINUX,
                getGeckoDriverDir: () => path.join(tempDir, "installed"),
            },
            "../registry": {
                default: {
                    getMatchedDriverVersion: () => null,
                    installBinary: (
                        _name: string,
                        _platform: string,
                        _version: string,
                        installFn: () => Promise<string>,
                    ) => installFn(),
                },
            },
        }).installLatestGeckoDriver;
    });

    afterEach(async () => {
        sandbox.restore();
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
        await fs.remove(tempDir);
    });

    const install = (): Promise<string> =>
        installLatestGeckoDriver("130", {
            browserDownloadMirrors: { chrome: null, chromium: null, firefox: null, geckodriver: mirror },
        });

    it("should fetch mirrored Cargo.toml, extract the Linux x64 archive and make the binary executable", async () => {
        const binaryPath = await install();

        assert.equal(await fs.readFile(binaryPath, "utf8"), "mirrored driver");
        if (process.platform !== "win32") {
            assert.equal((await fs.stat(binaryPath)).mode % 0o1000, 0o755);
        }
        assert.deepEqual(await fs.readdir(path.dirname(binaryPath)), ["geckodriver"]);
        assert.deepEqual(requests, [
            "/nested/geckodriver/Cargo.toml",
            "/nested/geckodriver/v0.37.1/geckodriver-v0.37.1-linux64.tar.gz",
        ]);
        assert.notCalled(upstreamDownloadStub);
    });

    it("should stop at a metadata HTTP failure without requesting an archive or upstream", async () => {
        metadataStatus = 404;

        await assert.isRejected(install(), "404");

        assert.deepEqual(requests, ["/nested/geckodriver/Cargo.toml"]);
        assert.notCalled(upstreamDownloadStub);
    });

    it("should not fall back to upstream when the archive is missing", async () => {
        archiveStatus = 404;

        await assert.isRejected(install(), "Unable to download geckodriver");

        assert.lengthOf(requests, 2);
        assert.notCalled(upstreamDownloadStub);
    });

    it("should clean temporary files and reject a corrupt archive", async () => {
        archive = Buffer.from("not a gzip archive");

        await assert.isRejected(install());

        assert.isEmpty(await fs.readdir(path.join(tempDir, "installed")));
        assert.notCalled(upstreamDownloadStub);
    });
});
