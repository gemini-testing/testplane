import EventEmitter from "events";
import type { Matches, Mock } from "webdriverio";
import logger from "./logger";

export interface PageLoaderOpts {
    selectors: string[];
    predicate?: () => boolean | Promise<boolean>;
    timeout: number;
    waitNetworkIdle: boolean;
    waitNetworkIdleTimeout: number;
}

export default class PageLoader extends EventEmitter {
    private session: WebdriverIO.Browser;
    private mock?: Mock | null;
    private selectors: string[];
    private predicate?: () => boolean | Promise<boolean>;
    private timeout: number;
    private waitNetworkIdle: boolean;
    private waitNetworkIdleTimeout: number;
    private totalRequests = 0;
    private networkResolved = false;

    constructor(
        session: WebdriverIO.Browser,
        { selectors, predicate, timeout, waitNetworkIdle, waitNetworkIdleTimeout }: PageLoaderOpts,
    ) {
        super();

        this.session = session;
        this.selectors = selectors;
        this.predicate = predicate;
        this.timeout = timeout;
        this.waitNetworkIdle = waitNetworkIdle;
        this.waitNetworkIdleTimeout = waitNetworkIdleTimeout;
    }

    public async load(goToPage: () => Promise<void>): Promise<void> {
        await this.initMock();

        await goToPage().catch(err => {
            this.emit("pageLoadError", err);
        });

        this.startAwaitingSelectorsWithTimeout();
        this.startAwaitingPredicateWithTimeout();
        this.startAwaitingNetworkIdleWithTimeout();
    }

    public unsubscribe(): Promise<void> | undefined {
        return this.mock?.restore().catch(() => {
            logger.warn("PageLoader: Got error while unsubscribing");
        });
    }

    private startAwaitingSelectorsWithTimeout(): void {
        const selectorPromises = this.selectors.map(async selector => {
            const element = await this.session.$(selector);
            await element.waitForExist({ timeout: this.timeout });
        });

        Promise.all(selectorPromises)
            .then(() => {
                this.emit("selectorsExist");
            })
            .catch(err => {
                this.emit("selectorsError", err);
            });
    }

    private startAwaitingPredicateWithTimeout(): void {
        if (!this.predicate) {
            return;
        }

        this.session
            .waitUntil(this.predicate, { timeout: this.timeout })
            .then(() => {
                this.emit("predicateResolved");
            })
            .catch(() => {
                this.emit("predicateError", new Error(`predicate was never truthy in ${this.timeout}ms`));
            });
    }

    private startAwaitingNetworkIdleWithTimeout(): void {
        if (!this.waitNetworkIdle) {
            return;
        }

        setTimeout(() => {
            const markSuccess = this.markNetworkIdle();
            if (markSuccess) {
                logger.warn(`PageLoader: Network idle timeout`);
            }
        }, this.timeout);
        setTimeout(() => {
            if (!this.totalRequests) {
                this.markNetworkIdle();
            }
        }, this.waitNetworkIdleTimeout);
    }

    private async initMock(): Promise<void> {
        if (!this.waitNetworkIdle) {
            return;
        }

        this.mock = await this.session.mock("**").catch(() => {
            logger.warn(`PageLoader: Could not create CDP interceptor`);

            return null;
        });

        if (!this.mock) {
            this.markNetworkIdle();

            return;
        }

        let pendingRequests = 0;
        let pendingIdleTimeout: NodeJS.Timeout;
        this.mock.on("request", () => {
            this.totalRequests++;
            pendingRequests++;
            clearTimeout(pendingIdleTimeout);
        });

        this.mock.on("continue", () => {
            pendingRequests--;

            if (!pendingRequests) {
                pendingIdleTimeout = setTimeout(() => this.markNetworkIdle(), this.waitNetworkIdleTimeout);
            }
        });

        this.mock.on("match", (match: Matches) => {
            if (this.isMatchError(match)) {
                this.emit("networkError", match);
            }
        });
    }

    private isMatchError(match: Matches): boolean {
        return match.statusCode >= 400 && match.statusCode < 600;
    }

    private markNetworkIdle(): boolean {
        if (this.networkResolved) {
            return false;
        }

        this.networkResolved = true;
        this.emit("networkResolved");
        return true;
    }
}
