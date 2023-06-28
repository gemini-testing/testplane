export = TestRunner;
declare class TestRunner {
    static create(...args: any[]): import(".");
    constructor(test: any, config: any, browserAgent: any);
    _test: any;
    _config: any;
    _browserAgent: any;
    run({ sessionId, sessionCaps, sessionOpts }: {
        sessionId: any;
        sessionCaps: any;
        sessionOpts: any;
    }): Promise<{
        hermioneCtx: any;
        meta: any;
    }>;
    _resetCursorPosition({ publicAPI: session }: {
        publicAPI: any;
    }): Promise<void>;
}
