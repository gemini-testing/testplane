// import { RequireExactlyOne } from "type-fest";
import { ViteBrowserCommunicator } from "./communicator.js";
import { HERMIONE_BROWSER_EVENT_SUFFIX, HERMIONE_WORKER_EVENT_SUFFIX } from "./constants.js";
import { BrowserError, type AvailableError } from "./errors/index.js";

declare global {
    interface Window {
        Mocha: Mocha;
        __hermione__: {
            pid: number;
            runUuid: string;
            cmdUuid: string,
            sessionId: WebdriverIO.Browser["sessionId"];
            capabilities: WebdriverIO.Browser["capabilities"];
            requestedCapabilities: WebdriverIO.Browser["options"]["capabilities"];
            customCommands: string[];
            file: string;
            errors: BrowserError[];
            communicator: ViteBrowserCommunicator
        };
        hermione: typeof Proxy;
        browser: WebdriverIO.Browser;
    }
}

export enum BrowserEventNames {
    init = `${HERMIONE_BROWSER_EVENT_SUFFIX}:init`,
    runnableResult = `${HERMIONE_BROWSER_EVENT_SUFFIX}:runnableResult`,
    runCommand = `${HERMIONE_BROWSER_EVENT_SUFFIX}:runCommand`,
}

export interface BrowserMessageEvents {
    [BrowserEventNames.init]: BrowserInitMessage;
    [BrowserEventNames.runnableResult]: BrowserRunnableResultMessage;
    [BrowserEventNames.runCommand]: BrowserRunCommandMessage;
}

interface BrowserBaseMessage {
    pid: number;
    runUuid: string;
    cmdUuid: string;
}

export interface BrowserInitMessage extends BrowserBaseMessage {
    errors: AvailableError[];
}

export interface BrowserRunnableResultMessage extends BrowserInitMessage {}

export interface BrowserRunCommandMessage extends BrowserBaseMessage {
    // TODO: maybe should rename it to cmd ???
    command: {
        name: string;
        args: unknown[];
    }
}

export type BrowserMessageByEvent<T extends BrowserEventNames> = BrowserMessageEvents[T];
export type BrowserMessage = BrowserMessageByEvent<BrowserEventNames>;

// TODO: use from nodejs code when migrate to esm
export enum WorkerEventNames {
    init = `${HERMIONE_WORKER_EVENT_SUFFIX}:init`,
    runRunnable = `${HERMIONE_WORKER_EVENT_SUFFIX}:runRunnable`,
    commandResult = `${HERMIONE_WORKER_EVENT_SUFFIX}:commandResult`,
}

export interface WorkerMessageEvents {
    [WorkerEventNames.init]: WorkerInitMessage;
    [WorkerEventNames.runRunnable]: WorkerRunRunnableMessage;
    [WorkerEventNames.commandResult]: WorkerCommandResultMessage;
}

interface WorkerBaseMessage {
    pid: number;
    runUuid: string;
    cmdUuid: string;
}

export interface WorkerInitMessage extends WorkerBaseMessage {
    sessionId: WebdriverIO.Browser["sessionId"];
    capabilities: WebdriverIO.Browser["capabilities"];
    requestedCapabilities: WebdriverIO.Browser["options"]["capabilities"];
    customCommands: string[];
    file: string;
};

export interface WorkerRunRunnableMessage extends WorkerBaseMessage {
    fullTitle: string;
}

export interface WorkerCommandResultMessage extends WorkerBaseMessage {
    result?: unknown;
    error?: Error;
}

// export type WorkerCommandResultMessage = RequireExactlyOne<{
//     result?: unknown;
//     error?: Error;
// }, "result" | "error">;

export type WorkerMessageByEvent<T extends WorkerEventNames> = WorkerMessageEvents[T];
export type WorkerMessage = WorkerMessageByEvent<WorkerEventNames>;
