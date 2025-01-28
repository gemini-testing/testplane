export = ExecutionThread;
declare class ExecutionThread {
    static create(...args: any[]): import("./execution-thread");
    constructor({ test, browser, testplaneCtx, screenshooter }: {
        test: any;
        browser: any;
        testplaneCtx: any;
        screenshooter: any;
    });
    _testplaneCtx: any;
    _screenshooter: any;
    _ctx: {
        browser: any;
        currentTest: any;
    };
    _runtimeConfig: any;
    _isReplBeforeTestOpened: boolean;
    run(runnable: any): globalThis.Promise<void>;
    _call(runnable: any): globalThis.Promise<any>;
    _setExecutionContext(context: any): void;
}
