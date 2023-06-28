export = HookRunner;
declare class HookRunner {
    static create(...args: any[]): import("./hook-runner");
    constructor(test: any, executionThread: any);
    _test: any;
    _executionThread: any;
    _failedSuite: any;
    hasBeforeEachHooks(): any;
    runBeforeEachHooks(): globalThis.Promise<void>;
    _runBeforeEachHooks(suite: any): globalThis.Promise<void>;
    _runHook(hook: any): any;
    hasAfterEachHooks(): any;
    runAfterEachHooks(): globalThis.Promise<void>;
    _runAfterEachHooks(suite: any): globalThis.Promise<void>;
}
