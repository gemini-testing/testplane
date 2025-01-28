export = TestRunner;
declare class TestRunner extends Runner {
    static create(...args: any[]): import(".");
    constructor({ test, file, config, browserAgent }: {
        test: any;
        file: any;
        config: any;
        browserAgent: any;
    });
    _test: any;
    _file: any;
    _config: any;
    _browserAgent: any;
    run({ sessionId, sessionCaps, sessionOpts, state }: {
        sessionId: any;
        sessionCaps: any;
        sessionOpts: any;
        state: any;
    }): Promise<{
        testplaneCtx: any;
        hermioneCtx: any;
        meta: any;
    }>;
    prepareToRun({ sessionId, sessionCaps, sessionOpts, state }: {
        sessionId: any;
        sessionCaps: any;
        sessionOpts: any;
        state: any;
    }): Promise<void>;
    _browser: any;
    finishRun(error: any): Promise<{
        testplaneCtx: any;
        hermioneCtx: any;
        meta: any;
    }>;
    runRunnables(ExecutionThreadCls: any): Promise<unknown>;
    _screenshooter: OneTimeScreenshooter | undefined;
    _getPreparePageActions(browser: any, history: any): (() => Promise<void>)[];
    _resetCursorPosition({ publicAPI: session }: {
        publicAPI: any;
    }): Promise<any>;
}
import { Runner } from "./runner";
import OneTimeScreenshooter = require("./one-time-screenshooter");
