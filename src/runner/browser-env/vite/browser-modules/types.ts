import { BROWSER_EVENT_PREFIX, WORKER_EVENT_PREFIX } from "./constants.js";
import { BrowserError, type ViteError } from "./errors/index.js";
import type { Socket } from "socket.io-client";

export type RunnableFn = (
    this: { browser: WebdriverIO.Browser },
    ctx: { browser: WebdriverIO.Browser },
) => Promise<unknown>;

export enum BrowserEventNames {
    initialize = `${BROWSER_EVENT_PREFIX}:initialize`,
    runBrowserCommand = `${BROWSER_EVENT_PREFIX}:runBrowserCommand`,
}

export interface BrowserRunBrowserCommandPayload {
    name: string;
    args: unknown[];
}

export interface BrowserViteEvents {
    [BrowserEventNames.initialize]: (payload: ViteError[]) => void;
    [BrowserEventNames.runBrowserCommand]: (
        payload: BrowserRunBrowserCommandPayload,
        cb: (args: [err: null | Error, result?: unknown]) => void,
    ) => void;
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
    customCommands: string[];
    // TODO: use BrowserConfig type after migrate to esm
    config: {
        automationProtocol: "webdriver" | "devtools";
        urlHttpTimeout: number | null;
        httpTimeout: number;
    };
}

export interface WorkerRunRunnablePayload {
    fullTitle: string;
}

export interface WorkerViteEvents {
    [WorkerEventNames.initialize]: (payload: WorkerInitializePayload) => void;
    [WorkerEventNames.finalize]: () => void;
    [WorkerEventNames.runRunnable]: (
        payload: WorkerRunRunnablePayload,
        cb: (...args: [null | ViteError[]]) => void,
    ) => void;
}

export type ViteBrowserEvents = Pick<WorkerViteEvents, WorkerEventNames.runRunnable>;
export type BrowserViteSocket = Socket<ViteBrowserEvents, BrowserViteEvents>;

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
    }
}
