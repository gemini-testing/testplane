import { BrowserPlatform } from "@puppeteer/browsers";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { syncBuiltinESMExports } from "node:module";
import { URL } from "node:url";

import proxyquire from "proxyquire";
import sinon, { type SinonSandbox } from "sinon";

import { BrowserName } from "../../../src/browser/types";
import type { installChrome as InstallChrome } from "../../../src/browser-installer/chrome/browser";
import * as browserInstallerUtils from "../../../src/browser-installer/utils";
import type { DownloadProgressCallback } from "../../../src/browser-installer/utils";

const BUILD_ID = "115.0.5790.170";
const MIRROR_PATH_PREFIX = "/nested/cache/chrome";
const LOOPBACK_HOSTNAME = "127.0.0.1";

type RecordedRequest = {
    method: string;
    pathname: string;
};

type RegistryInstallCall = {
    name: string;
    version: string;
};

const closeServer = async (server: http.Server): Promise<void> => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
};

describe("browser-installer mirror download contract", () => {
    let sandbox: SinonSandbox;
    let server: http.Server;
    let tempDir: string;
    let savedNoProxy: string | undefined;
    let savedNoProxyLowercase: string | undefined;

    const requests: RecordedRequest[] = [];
    const attemptedHosts: string[] = [];
    const registryInstallCalls: RegistryInstallCall[] = [];
    const downloadPromises: Promise<string>[] = [];
    const pendingArtifactResponses: http.ServerResponse[] = [];

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        requests.length = 0;
        attemptedHosts.length = 0;
        registryInstallCalls.length = 0;
        downloadPromises.length = 0;
        pendingArtifactResponses.length = 0;
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "testplane-mirror-contract-"));

        server = http.createServer((request, response) => {
            const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
            const method = request.method ?? "GET";

            requests.push({ method, pathname: requestUrl.pathname });

            if (requestUrl.pathname === `${MIRROR_PATH_PREFIX}/latest-versions-per-milestone.json`) {
                const body = JSON.stringify({ milestones: { "115": { version: BUILD_ID } } });

                response.writeHead(200, {
                    "content-type": "application/json",
                    "content-length": Buffer.byteLength(body),
                });
                response.end(body);
                return;
            }

            if (requestUrl.pathname.startsWith(`${MIRROR_PATH_PREFIX}/${BUILD_ID}/`) && method === "HEAD") {
                response.writeHead(200, { "content-length": "1" });
                response.end();
                return;
            }

            if (requestUrl.pathname.startsWith(`${MIRROR_PATH_PREFIX}/${BUILD_ID}/`) && method === "GET") {
                pendingArtifactResponses.push(response);

                if (pendingArtifactResponses.length === 2) {
                    for (const pendingResponse of pendingArtifactResponses) {
                        pendingResponse.writeHead(503, { "content-type": "text/plain" });
                        pendingResponse.end("mirror artifact unavailable");
                    }
                }

                return;
            }

            response.writeHead(404);
            response.end("not found");
        });

        await new Promise<void>((resolve, reject) => {
            server.once("error", reject);
            server.listen(0, "127.0.0.1", resolve);
        });

        const recordAndGuardHost = (hostname: string | null | undefined): void => {
            const attemptedHost = String(hostname);

            attemptedHosts.push(attemptedHost);

            if (attemptedHost !== LOOPBACK_HOSTNAME) {
                throw new Error(`Blocked unexpected outbound request to ${attemptedHost}`);
            }
        };
        const originalHttpRequest = http.request;
        const originalHttpsRequest = https.request;
        const originalFetch = globalThis.fetch;

        sandbox.stub(http, "request").callsFake(((options: http.RequestOptions, ...args: unknown[]) => {
            recordAndGuardHost(options.hostname);

            return Reflect.apply(originalHttpRequest, http, [options, ...args]);
        }) as typeof http.request);
        sandbox.stub(https, "request").callsFake(((options: https.RequestOptions, ...args: unknown[]) => {
            recordAndGuardHost(options.hostname);

            return Reflect.apply(originalHttpsRequest, https, [options, ...args]);
        }) as typeof https.request);
        sandbox.stub(globalThis, "fetch").callsFake((async (input, init) => {
            recordAndGuardHost(new URL(input as string).hostname);

            return originalFetch(input, init);
        }) as typeof fetch);
        syncBuiltinESMExports();

        savedNoProxy = process.env.NO_PROXY;
        savedNoProxyLowercase = process.env["no_proxy"];
        process.env.NO_PROXY = [savedNoProxy, "127.0.0.1", "localhost"].filter(Boolean).join(",");
        process.env["no_proxy"] = [savedNoProxyLowercase, "127.0.0.1", "localhost"].filter(Boolean).join(",");
    });

    afterEach(async () => {
        await closeServer(server);
        await Promise.allSettled(downloadPromises);
        sandbox.restore();
        syncBuiltinESMExports();

        if (savedNoProxy === undefined) {
            delete process.env.NO_PROXY;
        } else {
            process.env.NO_PROXY = savedNoProxy;
        }

        if (savedNoProxyLowercase === undefined) {
            delete process.env["no_proxy"];
        } else {
            process.env["no_proxy"] = savedNoProxyLowercase;
        }

        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    it("should use one mirrored build for Chrome and ChromeDriver without upstream fallback", async () => {
        const { port } = server.address() as AddressInfo;
        const mirror = `http://127.0.0.1:${port}${MIRROR_PATH_PREFIX}`;
        const registry = {
            getMatchedBrowserVersion: sandbox.stub().returns(null),
            getMatchedDriverVersion: sandbox.stub().returns(null),
            installBinary: sandbox
                .stub()
                .callsFake(
                    (
                        name: string,
                        _platform: string,
                        version: string,
                        installFn: (downloadProgressCallback: DownloadProgressCallback) => Promise<string>,
                    ): Promise<string> => {
                        registryInstallCalls.push({ name, version });
                        const downloadPromise = installFn(() => undefined);

                        downloadPromises.push(downloadPromise);

                        return downloadPromise;
                    },
                ),
        };
        const installerUtils = {
            ...browserInstallerUtils,
            getBrowserPlatform: (): BrowserPlatform => BrowserPlatform.LINUX,
            getBrowsersDir: (): string => path.join(tempDir, "browsers"),
            getChromeDriverDir: (): string => path.join(tempDir, "drivers"),
        };
        const installChromeDriver = proxyquire("src/browser-installer/chrome/driver", {
            "../registry": { default: registry },
            "../utils": installerUtils,
        }).installChromeDriver;
        const installChrome = proxyquire("src/browser-installer/chrome/browser", {
            "../registry": { default: registry },
            "../utils": installerUtils,
            "./driver": { installChromeDriver },
        }).installChrome as typeof InstallChrome;

        const result = await installChrome(BrowserName.CHROME, "115", {
            force: true,
            needWebDriver: true,
            browserDownloadMirrors: {
                chrome: mirror,
                chromium: null,
                firefox: null,
            },
        }).catch(error => error as Error);
        const downloadResults = await Promise.allSettled(downloadPromises);

        if (!(result instanceof Error)) {
            throw new Error(`Chrome installation unexpectedly succeeded at ${result}`);
        }

        assert.lengthOf(downloadResults, 2, "both artifact downloads should settle before cleanup");

        const downloadErrors = downloadResults.map(downloadResult => {
            assert.equal(downloadResult.status, "rejected");

            const error = (downloadResult as PromiseRejectedResult).reason as Error;

            assert.instanceOf(error, Error);
            assert.include(error.message, "server returned code 503");
            assert.include(error.message, mirror);
            assert.include(error.message, BUILD_ID);

            return error;
        });
        const chromeArchivePath = `${MIRROR_PATH_PREFIX}/${BUILD_ID}/linux64/chrome-linux64.zip`;
        const driverArchivePath = `${MIRROR_PATH_PREFIX}/${BUILD_ID}/linux64/chromedriver-linux64.zip`;

        assert.include(downloadErrors, result, "installChrome should preserve the original download error");
        assert.sameDeepMembers(requests, [
            { method: "GET", pathname: `${MIRROR_PATH_PREFIX}/latest-versions-per-milestone.json` },
            { method: "HEAD", pathname: chromeArchivePath },
            { method: "GET", pathname: chromeArchivePath },
            { method: "HEAD", pathname: driverArchivePath },
            { method: "GET", pathname: driverArchivePath },
        ]);
        assert.isTrue(
            downloadErrors.some(error => error.message.includes("chrome-linux64.zip")),
            "Chrome error should include the attempted mirror URL",
        );
        assert.isTrue(
            downloadErrors.some(error => error.message.includes("chromedriver-linux64.zip")),
            "ChromeDriver error should include the attempted mirror URL",
        );
        assert.sameDeepMembers(registryInstallCalls, [
            { name: "chrome", version: BUILD_ID },
            { name: "chromedriver", version: BUILD_ID },
        ]);
        assert.lengthOf(
            attemptedHosts,
            requests.length,
            "the outbound guard should observe every metadata and archive request",
        );
        assert.isTrue(
            attemptedHosts.every(hostname => hostname === LOOPBACK_HOSTNAME),
            `all requests must stay on loopback, got: ${attemptedHosts.join(", ")}`,
        );
    });
});
