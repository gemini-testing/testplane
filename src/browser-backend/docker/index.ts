import { randomUUID } from "crypto";
import { remote } from "@testplane/webdriverio";
import type { BrowserConfig } from "../../config/browser-config";
import { AsyncCleanupStack } from "../../utils/async-cleanup-stack";
import { getWdioCreateSessionOpts } from "../../utils/session-opts";
import { log, warn } from "../../utils/logger";
import type { BrowserBackend, BrowserBackendOptions } from "../index";
import { deleteWebdriverSession, trackSessionStart } from "../utils";
import { SelenoidDockerController } from "./controller";
import { timeDockerOperation } from "./timing";

interface SessionResources {
    cleanup: AsyncCleanupStack;
    cdpAvailable: boolean;
    closing: Promise<void> | null;
}

export class DockerBrowserBackend implements BrowserBackend {
    // Owned
    private readonly _controller: SelenoidDockerController;
    private readonly _sessions = new Map<WebdriverIO.Browser, SessionResources>();

    // Data
    private readonly _pending = new Set<Promise<void>>();
    private _disposal: Promise<void> | null = null;

    private constructor(controller: SelenoidDockerController) {
        this._controller = controller;
    }

    static async start(configs: BrowserConfig[]): Promise<DockerBrowserBackend> {
        if (!configs.length) {
            throw new Error("A Docker backend requires at least one browser.");
        }

        const timeout = Math.max(...configs.map(config => config.sessionRequestTimeout || config.httpTimeout));
        const controller = await SelenoidDockerController.create(configs, { timeout });

        return new DockerBrowserBackend(controller);
    }

    async prewarm(configs: BrowserConfig[]): Promise<void> {
        this._assertRunning();
        await Promise.all(configs.map(config => this._controller.ensureBrowser(config)));
    }

    async startSession(config: BrowserConfig, options: BrowserBackendOptions = {}): Promise<WebdriverIO.Browser> {
        this._assertRunning();

        await using startup = new AsyncCleanupStack();
        startup.use(trackSessionStart(this._pending));
        const cleanup = startup.use(new AsyncCleanupStack());
        await this._controller.ensureBrowser(config);
        this._assertRunning();

        const label = randomUUID();

        try {
            const sessionOpts = getWdioCreateSessionOpts(
                this._controller.gridUrl,
                config,
                options.browserVersionOverride,
            );
            const capabilities = this._controller.extendCapabilities(
                sessionOpts.capabilities as WebdriverIO.Capabilities,
                config,
                label,
            );
            sessionOpts.capabilities = capabilities;
            // Retrying POST /session can create a second, untracked browser.
            sessionOpts.connectionRetryCount = 0;

            const session = await timeDockerOperation(config.id, "create WebDriver session (launch browser)", () =>
                remote(sessionOpts),
            );
            cleanup.defer(async () => {
                if (await deleteWebdriverSession(session, config)) {
                    await timeDockerOperation(session.sessionId, "save Docker logs", () =>
                        this._controller.saveSessionLogs(
                            session.sessionId,
                            capabilities["selenoid:options"]?.logName ?? null,
                        ),
                    ).then(
                        file => log(`Docker session log: ${file}`),
                        error => warn(`Cannot save Docker session log (${session.sessionId}): ${error}`),
                    );
                }
            });
            this._assertRunning();

            const debuggerAddress = session.capabilities["goog:chromeOptions"]?.debuggerAddress;
            const cdpAvailable =
                debuggerAddress && !("browserWSEndpoint" in config && config.browserWSEndpoint)
                    ? await timeDockerOperation(session.sessionId, "prepare CDP (total)", () =>
                          this._controller.prepareCdp(
                              session.sessionId,
                              label,
                              config.sessionRequestTimeout || config.httpTimeout,
                          ),
                      )
                    : true;
            this._assertRunning();

            this._sessions.set(session, { cleanup: cleanup.move(), cdpAvailable, closing: null });

            return session;
        } catch (error) {
            const logs = await this._controller.getLogs().catch(() => "");
            if (logs && error instanceof Error) {
                const details = `\nDocker controller logs (${config.docker?.image}):\n${logs}`;
                error.stack = (error.stack || error.message) + details;
                error.message += details;
            }

            throw error;
        }
    }

    deleteSession(session: WebdriverIO.Browser): Promise<void> {
        const resources = this._sessions.get(session);
        if (!resources) {
            return Promise.resolve();
        }

        resources.closing ??= resources.cleanup.disposeAsync().finally(() => this._sessions.delete(session));

        return resources.closing;
    }

    isCdpAvailable(session: WebdriverIO.Browser): boolean {
        return this._sessions.get(session)?.cdpAvailable ?? true;
    }

    [Symbol.asyncDispose](): Promise<void> {
        return (this._disposal ??= this._dispose());
    }

    private async _dispose(): Promise<void> {
        await using cleanup = new AsyncCleanupStack();
        cleanup.use(this._controller);
        await Promise.allSettled(this._pending);

        for (const session of this._sessions.keys()) {
            cleanup.defer(() => this.deleteSession(session));
        }
    }

    private _assertRunning(): void {
        if (this._disposal) {
            throw new Error("Browser backend is disposed");
        }
    }
}
