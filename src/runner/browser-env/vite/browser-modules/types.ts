import { BROWSER_EVENT_SUFFIX, WORKER_EVENT_SUFFIX } from "./constants.js";
import { BrowserError, type ViteError } from "./errors/index.js";
import type { Socket } from "socket.io-client";

export enum BrowserEventNames {
    initialize = `${BROWSER_EVENT_SUFFIX}:initialize`,
}

export interface BrowserViteEvents {
    [BrowserEventNames.initialize]: (payload: ViteError[]) => void;
}

// TODO: use from nodejs code when migrate to esm
export enum WorkerEventNames {
    initialize = `${WORKER_EVENT_SUFFIX}:initialize`,
    finalize = `${WORKER_EVENT_SUFFIX}:finalize`,
    runRunnable = `${WORKER_EVENT_SUFFIX}:runRunnable`,
}

export interface WorkerInitializePayload {
    file: string;
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
            file: string;
            runUuid: string;
            errors: BrowserError[];
            socket: BrowserViteSocket;
        };
        testplane: typeof Proxy;
        hermione: typeof Proxy;
    }
}
