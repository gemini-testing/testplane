/// <reference types="node" />
import EventEmitter from "events";
export interface PageLoaderOpts {
    selectors: string[];
    predicate?: () => boolean | Promise<boolean>;
    timeout: number;
    waitNetworkIdle: boolean;
    waitNetworkIdleTimeout: number;
}
export default class PageLoader extends EventEmitter {
    private session;
    private mock?;
    private selectors;
    private predicate?;
    private timeout;
    private waitNetworkIdle;
    private waitNetworkIdleTimeout;
    private totalRequests;
    private networkResolved;
    constructor(session: WebdriverIO.Browser, { selectors, predicate, timeout, waitNetworkIdle, waitNetworkIdleTimeout }: PageLoaderOpts);
    load(goToPage: () => Promise<void>): Promise<void>;
    unsubscribe(): Promise<void> | undefined;
    private startAwaitingSelectorsWithTimeout;
    private startAwaitingPredicateWithTimeout;
    private startAwaitingNetworkIdleWithTimeout;
    private initMock;
    private isMatchError;
    private markNetworkIdle;
}
