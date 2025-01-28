import NodejsEnvTestRunner from "../../../runner/test-runner";
import type { WorkerTestRunnerRunOpts, WorkerTestRunnerCtorOpts } from "../../../runner/test-runner/types";
import type { WorkerRunTestResult } from "../../../testplane";
import type { BrowserHistory } from "../../../../types";
import type { Browser } from "../../../../browser/types";
export declare class TestRunner extends NodejsEnvTestRunner {
    private _socket;
    private _runUuid;
    private _runOpts;
    private _isReconnected;
    private _broInitResOnReconnect;
    constructor(opts: WorkerTestRunnerCtorOpts);
    run(opts: WorkerTestRunnerRunOpts): Promise<WorkerRunTestResult>;
    private _runWithAbort;
    private _waitBroInitOnReconnect;
    _getPreparePageActions(browser: Browser, history: BrowserHistory): (() => Promise<void>)[];
    private _handleRunBrowserCommand;
    private _handleRunExpectMatcher;
    private _openViteUrl;
}
