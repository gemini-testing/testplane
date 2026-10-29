import { randomUUID } from "crypto";
import type { BrowserConfig } from "../../config/browser-config";
import { AsyncCleanupStack } from "../../utils/async-cleanup-stack";
import { getWdioCreateSessionOpts } from "../../utils/session-opts";
import { log, warn } from "../../utils/logger";
import type { BrowserBackendOptions } from "../index";
import { BaseBrowserBackend, type SessionInfo } from "../base";
import { connectSession, type SessionState } from "../session";
import { checkDockerParallelism } from "./docker";
import type { DockerBrowserEntry, DockerController } from "./controller";
import { SelenoidDockerController } from "./selenoid-docker-controller";
import { timeDockerOperation } from "./docker-timing";

export class DockerBrowserBackend extends BaseBrowserBackend {
    private queue: Promise<unknown> = Promise.resolve();

    private constructor(
        private readonly controller: DockerController,
        private readonly entries: Map<BrowserConfig, DockerBrowserEntry>,
    ) {
        super();
        this.resources.use(controller);
    }

    static async create(
        configs: BrowserConfig[],
        parallelism: number,
        totalParallelism = parallelism,
    ): Promise<DockerBrowserBackend> {
        const maximum = await checkDockerParallelism(totalParallelism);
        const entries = new Map(configs.map(config => [config, browserEntry(config)]));
        const timeout = Math.max(...configs.map(config => config.sessionRequestTimeout || config.httpTimeout));
        const controller = await SelenoidDockerController.create([...entries.values()], {
            timeout,
            limit: parallelism || maximum,
        });
        return new DockerBrowserBackend(controller, entries);
    }

    private getEntry(config: BrowserConfig): Promise<DockerBrowserEntry> {
        const pending = this.queue.then(async () => {
            let entry = this.entries.get(config);
            if (!entry) {
                entry = browserEntry(config);
                await this.controller.addBrowser(entry);
                this.entries.set(config, entry);
            }
            return entry;
        });
        this.queue = pending.catch(() => null);
        return pending;
    }

    protected async startSession(
        config: BrowserConfig,
        options: BrowserBackendOptions,
        cleanup: AsyncCleanupStack,
        state: SessionState,
    ): Promise<SessionInfo> {
        const entry = await this.getEntry(config);
        const container = cleanup.adopt(
            this.controller.allocateSession(entry.browserVersion, config.sessionRequestTimeout || config.httpTimeout),
            async container => {
                if (state.deleted) container.setSessionId(null);
                await container[Symbol.asyncDispose]();
            },
        );
        try {
            const sessionOpts = getWdioCreateSessionOpts(container.gridUrl, config, options.browserVersionOverride);
            sessionOpts.capabilities = container.extendCapabilities(
                sessionOpts.capabilities as WebdriverIO.Capabilities,
            );
            // Retrying POST /session can create a second, untracked browser.
            sessionOpts.connectionRetryCount = 0;
            const browser = await timeDockerOperation(config.id, "create WebDriver session (launch browser)", () =>
                connectSession(sessionOpts, config, cleanup, state),
            );
            container.setSessionId(browser.sessionId);
            cleanup.defer(async () => {
                await timeDockerOperation(browser.sessionId, "save Docker logs", () =>
                    container.saveLogs(browser.sessionId),
                ).then(
                    file => log(`Docker session log: ${file}`),
                    error => warn(`Cannot save Docker session log: ${error}`),
                );
            });
            const debuggerAddress = browser.capabilities["goog:chromeOptions"]?.debuggerAddress;
            const cdpAvailable =
                debuggerAddress && !("browserWSEndpoint" in config && config.browserWSEndpoint)
                    ? await timeDockerOperation(browser.sessionId, "prepare CDP (total)", () =>
                          container.prepareCdp(browser.sessionId),
                      )
                    : null;
            return { browser, cdpAvailable: cdpAvailable === false ? false : null };
        } catch (error) {
            const logs = await container.getLogs().catch(() => "");
            if (logs && error instanceof Error) {
                const details = `\nDocker controller logs (${config.docker?.image}):\n${logs}`;
                error.message += details;
                error.stack = (error.stack || error.message) + details;
            }
            throw error;
        }
    }
}

function browserEntry(config: BrowserConfig): DockerBrowserEntry {
    return {
        config: config.docker,
        browserName:
            config.desiredCapabilities?.browserName ||
            config.desiredCapabilities?.["appium:deviceName"] ||
            (config.desiredCapabilities as { deviceName?: string } | null)?.deviceName ||
            "",
        browserVersion: `testplane-${randomUUID()}`,
    };
}
