import { pick } from "lodash";
import { remote } from "@testplane/webdriverio";
import type { BrowserConfig } from "../../config/browser-config";
import { W3C_CAPABILITIES, VENDOR_CAPABILITIES } from "../../constants/config";
import { VENDOR_CAPABILITY_BY_BROWSER_NAME } from "../../browser/types";
import { AsyncCleanupStack } from "../../utils/async-cleanup-stack";
import { getNormalizedBrowserName } from "../../utils/browser";
import { getWdioCreateSessionOpts } from "../../utils/session-opts";
import type { BrowserBackend, BrowserBackendOptions, SessionCloseOptions } from "../index";
import { deleteWebdriverSession, trackSessionStart } from "../utils";
import { WebdriverPool, type WdProcess } from "./webdriver-pool";
import { BrowserDownloadMirrors } from "../../config/types";

export interface LocalBrowserBackendOptions {
    browserDownloadMirrors?: BrowserDownloadMirrors;
    areLocalWdDebugLogsEnabled?: boolean;
}

export class LocalBrowserBackend implements BrowserBackend {
    private readonly _drivers = new WebdriverPool();
    private readonly _sessions = new Map<
        WebdriverIO.Browser,
        { driver: WdProcess; close(force: boolean): Promise<void> }
    >();
    private readonly _pending = new Set<Promise<void>>();
    private _disposal: Promise<void> | null = null;

    constructor(private readonly _opts: LocalBrowserBackendOptions) {}

    async startSession(config: BrowserConfig, options: BrowserBackendOptions = {}): Promise<WebdriverIO.Browser> {
        if (this._disposal) throw new Error("Browser backend is disposed");
        await using startup = new AsyncCleanupStack();
        startup.use(trackSessionStart(this._pending));
        const cleanup = startup.use(new AsyncCleanupStack());
        const browserName = getNormalizedBrowserName(config.desiredCapabilities?.browserName);
        if (!browserName) {
            throw new Error(`Running auto local "${config.desiredCapabilities?.browserName}" is unsupported`);
        }

        const { installBrowser, resolveBrowserVersion } = await import("../../browser-installer");
        const browserDownloadMirrors = this._opts.browserDownloadMirrors;
        const version =
            options.browserVersionOverride ||
            config.desiredCapabilities?.browserVersion ||
            (config.desiredCapabilities as { version?: string } | null)?.version ||
            (await resolveBrowserVersion(browserName, { browserDownloadMirrors }));
        let force = true;
        let deleted = false;
        const driver = cleanup.adopt(
            await this._drivers.getWebdriver(browserName, version, {
                debug: this._opts.areLocalWdDebugLogsEnabled,
                browserDownloadMirrors,
            }),
            async driver => {
                if (!force && deleted) {
                    try {
                        await driver.free();
                        return;
                    } catch {
                        // A driver that could not be returned to the pool is not reusable.
                    }
                }
                await driver[Symbol.asyncDispose]();
            },
        );

        const sessionOpts = getWdioCreateSessionOpts(driver.gridUrl, config, version);
        const executable = await installBrowser(browserName, version, {
            shouldInstallWebDriver: false,
            shouldInstallUbuntuPackages: true,
            browserDownloadMirrors,
        });
        const capabilities = sessionOpts.capabilities as WebdriverIO.Capabilities;
        const vendor = VENDOR_CAPABILITY_BY_BROWSER_NAME[browserName];
        if (executable && vendor) {
            capabilities[vendor] ||= {};
            capabilities[vendor]!.binary ||= executable;
        }
        sessionOpts.capabilities = pick(capabilities, [...W3C_CAPABILITIES, ...VENDOR_CAPABILITIES[browserName]]);

        const session = await remote(sessionOpts);
        cleanup.defer(async () => {
            deleted = await deleteWebdriverSession(session, config);
        });
        if (this._disposal) throw new Error("Browser backend is disposed");

        force = false;
        const resources = cleanup.move();
        let closing: Promise<void> | null = null;
        this._sessions.set(session, {
            driver,
            close: forced => {
                force ||= forced;
                closing ??= resources.disposeAsync().finally(() => this._sessions.delete(session));
                return closing;
            },
        });
        return session;
    }

    deleteSession(session: WebdriverIO.Browser, { force = false }: SessionCloseOptions = {}): Promise<void> {
        return this._sessions.get(session)?.close(force) ?? Promise.resolve();
    }

    getDriverPid(session: WebdriverIO.Browser): number | null {
        return this._sessions.get(session)?.driver.getPid() ?? null;
    }

    [Symbol.asyncDispose](): Promise<void> {
        return (this._disposal ??= this._dispose());
    }

    private async _dispose(): Promise<void> {
        await using cleanup = new AsyncCleanupStack();
        cleanup.use(this._drivers);
        await Promise.allSettled(this._pending);
        for (const session of this._sessions.keys()) cleanup.defer(() => this.deleteSession(session));
    }
}
