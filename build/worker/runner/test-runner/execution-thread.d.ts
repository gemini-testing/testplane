export = ExecutionThread;
declare class ExecutionThread {
    static create(...args: any[]): import("./execution-thread");
    constructor({ test, browser, hermioneCtx, screenshooter }: {
        test: any;
        browser: any;
        hermioneCtx: any;
        screenshooter: any;
    });
    _hermioneCtx: any;
    _screenshooter: any;
    _ctx: {
        browser: any;
        currentTest: any;
    };
    run(runnable: any): Promise<void>;
    _call(runnable: any): any;
    _setExecutionContext(context: any): void;
}
