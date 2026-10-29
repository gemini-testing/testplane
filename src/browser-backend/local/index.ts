import { pick } from "lodash";
import type { Config } from "../../config";
import type { BrowserConfig } from "../../config/browser-config";
import { W3C_CAPABILITIES, VENDOR_CAPABILITIES } from "../../constants/config";
import { VENDOR_CAPABILITY_BY_BROWSER_NAME } from "../../browser/types";
import { AsyncCleanupStack } from "../../utils/async-cleanup-stack";
import { getNormalizedBrowserName } from "../../utils/browser";
import { getWdioCreateSessionOpts } from "../../utils/session-opts";
import type { BrowserBackendOptions } from "../index";
import { BaseBrowserBackend, type SessionInfo } from "../base";
import { connectSession, type SessionState } from "../session";
import { WebdriverPool } from "./webdriver-pool";

export class LocalBrowserBackend extends BaseBrowserBackend {
    private readonly drivers = this.resources.use(new WebdriverPool());

    constructor(private readonly config: Config) {
        super();
    }

    protected async startSession(
        config: BrowserConfig,
        options: BrowserBackendOptions,
        cleanup: AsyncCleanupStack,
        state: SessionState,
    ): Promise<SessionInfo> {
        const browserName = getNormalizedBrowserName(config.desiredCapabilities?.browserName);
        if (!browserName) {
            throw new Error(`Running auto local "${config.desiredCapabilities?.browserName}" is unsupported`);
        }

        const { installBrowser, resolveBrowserVersion } = await import("../../browser-installer");
        const browserDownloadMirrors = this.config.browserDownloadMirrors;
        const version =
            options.browserVersionOverride ||
            config.desiredCapabilities?.browserVersion ||
            (config.desiredCapabilities as { version?: string } | null)?.version ||
            (await resolveBrowserVersion(browserName, { browserDownloadMirrors }));
        const driver = cleanup.adopt(
            await this.drivers.getWebdriver(browserName, version, {
                debug: this.config.system.debug,
                browserDownloadMirrors,
            }),
            async driver => {
                if (!state.force && state.deleted) {
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

        return {
            browser: await connectSession(sessionOpts, config, cleanup, state),
            driverPid: driver.getPid() ?? null,
        };
    }
}
