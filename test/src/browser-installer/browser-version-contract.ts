import { BrowserPlatform } from "@puppeteer/browsers";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { URL } from "node:url";
import proxyquire from "proxyquire";

import type { installBrowser as InstallBrowser } from "../../../src/browser-installer/install";
import * as browserInstallerUtils from "../../../src/browser-installer/utils";
import { BrowserName } from "../../../src/browser/types";

const MIRROR_PATH_PREFIX = "/nested/cache/chrome";
const METADATA_PATH = `${MIRROR_PATH_PREFIX}/latest-versions-per-milestone.json`;
const FIXTURE_ARCHIVE_PATH = path.resolve(__dirname, "../../fixtures/browser-installer/chrome-linux64.zip");
const FIXTURE_MARKER = "testplane chrome fixture marker\n";
const BUILDS_BY_MILESTONE = {
    "139": "139.0.7258.1",
    "144": "144.0.7559.1",
} as const;

type RecordedRequest = {
    method: string;
    pathname: string;
};

type RegistryContents = {
    binaries: Record<string, Record<string, string>>;
};

const appendNoProxy = (value: string | undefined): string =>
    [value, "127.0.0.1", "localhost"].filter(Boolean).join(",");

const createInstallBrowser = (cacheDir: string): typeof InstallBrowser => {
    const installerUtils = {
        ...browserInstallerUtils,
        getBrowserPlatform: (): BrowserPlatform => BrowserPlatform.LINUX,
        getBrowsersDir: (): string => path.join(cacheDir, "browsers"),
        getRegistryPath: (): string => path.join(cacheDir, "registry.json"),
    };
    const registry = proxyquire("../../../src/browser-installer/registry", {
        "../utils": installerUtils,
    }).default;
    const installChrome = proxyquire("../../../src/browser-installer/chrome/browser", {
        "../registry": { default: registry },
        "../utils": installerUtils,
    }).installChrome;

    return proxyquire("../../../src/browser-installer/install", {
        "./chrome": { installChrome },
        "./ubuntu-packages": { isUbuntu: async (): Promise<boolean> => false },
    }).installBrowser as typeof InstallBrowser;
};

describe("browser-installer numeric browser version contract", () => {
    let server: http.Server;
    let tempDir: string;
    let fixtureArchive: Buffer;
    let savedNoProxy: string | undefined;
    let savedNoProxyLowercase: string | undefined;

    const requests: RecordedRequest[] = [];

    before(async () => {
        fixtureArchive = await fs.promises.readFile(FIXTURE_ARCHIVE_PATH);
    });

    beforeEach(async () => {
        requests.length = 0;
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "testplane-browser-version-contract-"));
        savedNoProxy = process.env.NO_PROXY;
        savedNoProxyLowercase = process.env["no_proxy"];
        process.env.NO_PROXY = appendNoProxy(savedNoProxy);
        process.env["no_proxy"] = appendNoProxy(savedNoProxyLowercase);
        server = http.createServer((request, response) => {
            const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
            const method = request.method ?? "GET";

            requests.push({ method, pathname: requestUrl.pathname });

            if (requestUrl.pathname === METADATA_PATH) {
                const body = JSON.stringify({
                    milestones: Object.fromEntries(
                        Object.entries(BUILDS_BY_MILESTONE).map(([milestone, version]) => [milestone, { version }]),
                    ),
                });

                response.writeHead(200, {
                    "content-type": "application/json",
                    "content-length": Buffer.byteLength(body),
                });
                response.end(body);
                return;
            }

            const isKnownArchive = Object.values(BUILDS_BY_MILESTONE).some(
                buildId => requestUrl.pathname === `${MIRROR_PATH_PREFIX}/${buildId}/linux64/chrome-linux64.zip`,
            );

            if (isKnownArchive && (method === "HEAD" || method === "GET")) {
                response.writeHead(200, {
                    "content-type": "application/zip",
                    "content-length": fixtureArchive.length,
                });
                response.end(method === "GET" ? fixtureArchive : undefined);
                return;
            }

            response.writeHead(404);
            response.end("not found");
        });

        await new Promise<void>((resolve, reject) => {
            server.once("error", reject);
            server.listen(0, "127.0.0.1", resolve);
        });
    });

    afterEach(async () => {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
        await fs.promises.rm(tempDir, { recursive: true, force: true });

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
    });

    it("should resolve and install numeric and explicit-decimal Chrome milestones identically", async function () {
        this.timeout(30_000);

        const { port } = server.address() as AddressInfo;
        const mirror = `http://127.0.0.1:${port}${MIRROR_PATH_PREFIX}`;

        for (const [milestone, buildId] of Object.entries(BUILDS_BY_MILESTONE)) {
            const results: Array<{ relativeInstalledPath: string; requests: RecordedRequest[] }> = [];

            for (const version of [milestone, `${milestone}.0`]) {
                const cacheDir = path.join(tempDir, `cache-${version}`);
                const requestOffset = requests.length;
                const installedPath = await createInstallBrowser(cacheDir)(BrowserName.CHROME, version, {
                    force: true,
                    browserDownloadMirrors: { chrome: mirror, chromium: null, firefox: null },
                });

                if (!installedPath) {
                    throw new Error("Chrome installation unexpectedly returned no path");
                }

                const archivePath = `${MIRROR_PATH_PREFIX}/${buildId}/linux64/chrome-linux64.zip`;
                const caseRequests = requests.slice(requestOffset);
                const relativeInstalledPath = path.relative(cacheDir, installedPath);
                const expectedInstalledPath = path.join(
                    "browsers",
                    "chrome",
                    `linux-${buildId}`,
                    "chrome-linux64",
                    "chrome",
                );
                const registryPath = path.join(cacheDir, "registry.json");
                const registryContents = JSON.parse(
                    await fs.promises.readFile(registryPath, "utf8"),
                ) as RegistryContents;

                assert.deepEqual(caseRequests, [
                    { method: "GET", pathname: METADATA_PATH },
                    { method: "HEAD", pathname: archivePath },
                    { method: "GET", pathname: archivePath },
                ]);
                assert.equal(relativeInstalledPath, expectedInstalledPath);
                assert.equal(await fs.promises.readFile(installedPath, "utf8"), FIXTURE_MARKER);
                assert.equal(
                    path.resolve(registryPath, registryContents.binaries.chrome_linux[buildId]),
                    installedPath,
                );

                results.push({ relativeInstalledPath, requests: caseRequests });
            }

            assert.deepEqual(results[0], results[1]);
        }
    });
});
