import { CONSOLE_METHODS } from "./constants.js";
import { BrowserError, type ViteError } from "./errors/index.js";
import type { Socket } from "socket.io-client";
import type { Expect, MatcherState } from "expect";
import type { ChainablePromiseArray, ChainablePromiseElement, ElementArray } from "@testplane/webdriverio";
export type RunnableFn = (this: {
    browser: WebdriverIO.Browser;
}, ctx: {
    browser: WebdriverIO.Browser;
}) => Promise<unknown>;
export declare enum BrowserEventNames {
    initialize = "browser:initialize",
    runBrowserCommand = "browser:runBrowserCommand",
    runExpectMatcher = "browser:runExpectMatcher",
    callConsoleMethod = "browser:callConsoleMethod",
    reconnect = "browser:reconnect"
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
    element?: WebdriverIO.Element | ChainablePromiseElement;
    context?: WebdriverIO.Browser | WebdriverIO.Element | ElementArray | ChainablePromiseElement | ChainablePromiseArray;
}
export interface BrowserCallConsoleMethodPayload {
    method: (typeof CONSOLE_METHODS)[number];
    args: unknown[];
}
export interface BrowserViteEvents {
    [BrowserEventNames.initialize]: (payload: ViteError[]) => void;
    [BrowserEventNames.runBrowserCommand]: (payload: BrowserRunBrowserCommandPayload, cb: (args: [err: null | Error, result?: unknown]) => void) => void;
    [BrowserEventNames.runExpectMatcher]: (payload: BrowserRunExpectMatcherPayload, cb: (args: [{
        pass: boolean;
        message: string;
    }]) => void) => void;
    [BrowserEventNames.callConsoleMethod]: (payload: BrowserCallConsoleMethodPayload) => void;
    [BrowserEventNames.reconnect]: () => void;
}
export declare enum WorkerEventNames {
    initialize = "worker:initialize",
    finalize = "worker:finalize",
    runRunnable = "worker:runRunnable"
}
export interface WorkerInitializePayload {
    file: string;
    sessionId: WebdriverIO.Browser["sessionId"];
    capabilities: WebdriverIO.Browser["capabilities"];
    requestedCapabilities: WebdriverIO.Capabilities;
    customCommands: {
        name: string;
        elementScope: boolean;
    }[];
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
    (this: MatcherState, context: BrowserRunExpectMatcherPayload["context"], ...args: any[]): AsyncExpectationResult;
};
declare global {
    interface Window {
        Mocha: unknown;
        __testplane__: {
            runUuid: string;
            errors: BrowserError[];
            socket: BrowserViteSocket;
            browser: WebdriverIO.Browser;
            mockCache: Map<string, unknown>;
        } & WorkerInitializePayload;
        testplane: typeof Proxy;
        hermione: typeof Proxy;
        browser: WebdriverIO.Browser;
        expect: Expect;
    }
}
export type MockFactory = (originalImport?: unknown) => unknown;
