import { BROWSER_EVENT_PREFIX, WORKER_EVENT_PREFIX, CONSOLE_METHODS } from "./constants.js";
import { BrowserError, type ViteError } from "./errors/index.js";
import type { Socket } from "socket.io-client";
import type { Expect, MatcherState } from "expect";
import type { ChainablePromiseElement, ElementArray } from "webdriverio";

export type RunnableFn = (
    this: { browser: WebdriverIO.Browser },
    ctx: { browser: WebdriverIO.Browser },
) => Promise<unknown>;

export enum BrowserEventNames {
    initialize = `${BROWSER_EVENT_PREFIX}:initialize`,
    runBrowserCommand = `${BROWSER_EVENT_PREFIX}:runBrowserCommand`,
    runExpectMatcher = `${BROWSER_EVENT_PREFIX}:runExpectMatcher`,
    callConsoleMethod = `${BROWSER_EVENT_PREFIX}:callConsoleMethod`,
    reconnect = `${BROWSER_EVENT_PREFIX}:reconnect`,
}

export interface BrowserRunBrowserCommandPayload {
    name: string;
    args: unknown[];
    element?: WebdriverIO.Element;
}

export interface BrowserRunExpectMatcherPayload {
    name: string;
    scope: MatcherState;
    args: unknown[];
    element?: WebdriverIO.Element | ChainablePromiseElement<WebdriverIO.Element>;
    context?: WebdriverIO.Browser | WebdriverIO.Element | ElementArray | ChainablePromiseElement<WebdriverIO.Element>;
}

export interface BrowserCallConsoleMethodPayload {
    method: (typeof CONSOLE_METHODS)[number];
    args: unknown[];
}

export interface BrowserViteEvents {
    [BrowserEventNames.initialize]: (payload: ViteError[]) => void;
    [BrowserEventNames.runBrowserCommand]: (
        payload: BrowserRunBrowserCommandPayload,
        cb: (args: [err: null | Error, result?: unknown]) => void,
    ) => void;
    [BrowserEventNames.runExpectMatcher]: (
        payload: BrowserRunExpectMatcherPayload,
        cb: (args: [{ pass: boolean; message: string }]) => void,
    ) => void;
    [BrowserEventNames.callConsoleMethod]: (payload: BrowserCallConsoleMethodPayload) => void;
    [BrowserEventNames.reconnect]: () => void;
}

// TODO: use from nodejs code when migrate to esm
export enum WorkerEventNames {
    initialize = `${WORKER_EVENT_PREFIX}:initialize`,
    finalize = `${WORKER_EVENT_PREFIX}:finalize`,
    runRunnable = `${WORKER_EVENT_PREFIX}:runRunnable`,
}

export interface WorkerInitializePayload {
    file: string;
    sessionId: WebdriverIO.Browser["sessionId"];
    capabilities: WebdriverIO.Browser["capabilities"];
    requestedCapabilities: WebdriverIO.Browser["options"]["capabilities"];
    customCommands: { name: string; elementScope: boolean }[];
    // TODO: use BrowserConfig type after migrate to esm
    config: {
        automationProtocol: "webdriver" | "devtools";
        urlHttpTimeout: number | null;
        httpTimeout: number;
    };
    expectMatchers: string[];
}

export interface WorkerRunRunnablePayload {
    fullTitle: string;
}

export type WorkerRunRunnableCb = (...args: [null | ViteError[]]) => void;

export interface WorkerViteEvents {
    [WorkerEventNames.initialize]: (payload: WorkerInitializePayload) => void;
    [WorkerEventNames.finalize]: () => void;
    [WorkerEventNames.runRunnable]: (payload: WorkerRunRunnablePayload, cb: WorkerRunRunnableCb) => void;
}

export type ViteBrowserEvents = Pick<WorkerViteEvents, WorkerEventNames.runRunnable>;
export type BrowserViteSocket = Socket<ViteBrowserEvents, BrowserViteEvents>;

export type SyncExpectationResult = {
    pass: boolean;
    message(): string;
};

export type AsyncExpectationResult = Promise<SyncExpectationResult>;

export type MockMatcherFn = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this: MatcherState, context: BrowserRunExpectMatcherPayload["context"], ...args: any[]): AsyncExpectationResult;
};

declare global {
    interface Window {
        Mocha: Mocha;
        __testplane__: {
            runUuid: string;
            errors: BrowserError[];
            socket: BrowserViteSocket;
            browser: WebdriverIO.Browser;
        } & WorkerInitializePayload;
        testplane: typeof Proxy;
        hermione: typeof Proxy;
        browser: WebdriverIO.Browser;
        expect: Expect;
    }
}
