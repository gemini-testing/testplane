// import { RequireExactlyOne } from "type-fest";
import { ViteBrowserCommunicator } from "./communicator.js";
import { HERMIONE_BROWSER_EVENT_SUFFIX, HERMIONE_WORKER_EVENT_SUFFIX } from "./constants.js";
import { BrowserError, type AvailableError } from "./errors/index.js";

declare global {
    interface Window {
        Mocha: Mocha;
        __hermione__: WorkerInitMessage & {
            errors: BrowserError[];
            communicator: ViteBrowserCommunicator
        };
        hermione: typeof Proxy;
        browser: WebdriverIO.Browser;
    }
}

// TODO: maybe rename everythin on ...Request and ...Response (like in wdio) ???
export enum BrowserEventNames {
    init = `${HERMIONE_BROWSER_EVENT_SUFFIX}:init`,
    runnableResult = `${HERMIONE_BROWSER_EVENT_SUFFIX}:runnableResult`,
    runCommand = `${HERMIONE_BROWSER_EVENT_SUFFIX}:runCommand`, // TODO: rename on runBrowserCmd and browserCmdResult
    // getExpectMatchers = `${HERMIONE_BROWSER_EVENT_SUFFIX}:getExpectMatchers`,
    runExpectMatcher = `${HERMIONE_BROWSER_EVENT_SUFFIX}:runExpectMatcher`,
}

export interface BrowserMessageEvents {
    [BrowserEventNames.init]: BrowserInitMessage;
    [BrowserEventNames.runnableResult]: BrowserRunnableResultMessage;
    [BrowserEventNames.runCommand]: BrowserRunCommandMessage;
    [BrowserEventNames.runExpectMatcher]: BrowserRunExpectMatcherMessage;
}

interface BrowserBaseMessage {
    pid: number;
    runUuid: string;
    cmdUuid: string;
}

export interface ExpectMatcherMessage {
    name: string;
    /**
     * this should be `MatcherState` from `expect` but don't want to introduce
     * this as a dependency to this package, therefor keep it as `any` for now
     */
    scope: any;
    args: unknown[];
    element?: any | any[];
    context?: unknown;
    /**
     * propagate error stack for inline snapshots
     */
    errorStack?: string;
}

export interface BrowserInitMessage extends BrowserBaseMessage {
    errors: AvailableError[];
}

export interface BrowserRunnableResultMessage extends BrowserInitMessage {}
export interface BrowserGetExpectMatcherMessage extends BrowserBaseMessage {}

export interface BrowserRunCommandMessage extends BrowserBaseMessage {
    // TODO: maybe should rename it to cmd ???
    command: {
        name: string;
        args: unknown[];
    }
}

export interface BrowserRunExpectMatcherMessage extends BrowserBaseMessage {
    matcher: ExpectMatcherMessage;
}

export type BrowserMessageByEvent<T extends BrowserEventNames> = BrowserMessageEvents[T];
export type BrowserMessage = BrowserMessageByEvent<BrowserEventNames>;

// TODO: use from nodejs code when migrate to esm
export enum WorkerEventNames {
    init = `${HERMIONE_WORKER_EVENT_SUFFIX}:init`,
    runRunnable = `${HERMIONE_WORKER_EVENT_SUFFIX}:runRunnable`,
    commandResult = `${HERMIONE_WORKER_EVENT_SUFFIX}:commandResult`,
    expectMatcherResult = `${HERMIONE_WORKER_EVENT_SUFFIX}:expectMatcherResult`,
}

export interface WorkerMessageEvents {
    [WorkerEventNames.init]: WorkerInitMessage;
    [WorkerEventNames.runRunnable]: WorkerRunRunnableMessage;
    [WorkerEventNames.commandResult]: WorkerCommandResultMessage;
    [WorkerEventNames.expectMatcherResult]: WorkerExpectMatherResultMessage;
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
    expectMatchers: string[];
    file: string;
};

export interface WorkerRunRunnableMessage extends WorkerBaseMessage {
    fullTitle: string;
};

export interface WorkerCommandResultMessage extends WorkerBaseMessage {
    result?: unknown;
    error?: Error;
};

export interface WorkerExpectMatherResultMessage extends WorkerBaseMessage {
    pass: boolean;
    message: string;
};

// export type WorkerCommandResultMessage = RequireExactlyOne<{
//     result?: unknown;
//     error?: Error;
// }, "result" | "error">;

export type WorkerMessageByEvent<T extends WorkerEventNames> = WorkerMessageEvents[T];
export type WorkerMessage = WorkerMessageByEvent<WorkerEventNames>;
