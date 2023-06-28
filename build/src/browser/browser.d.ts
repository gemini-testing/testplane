export = Browser;
declare class Browser {
    static create(config: any, id: any, version: any): import("./browser");
    constructor(config: any, id: any, version: any);
    id: any;
    version: any;
    _config: any;
    _debug: any;
    _session: any;
    _callstackHistory: import("./history/callstack") | null;
    _state: {
        isBroken: boolean;
    };
    attach(sessionId: any, sessionCaps: any, sessionOpts: any): Promise<void>;
    setHttpTimeout(timeout: any): void;
    restoreHttpTimeout(): void;
    applyState(state: any): void;
    _addCommands(): void;
    _addSteps(): void;
    _addHistory(): void;
    _addExtendOptionsMethod(session: any): void;
    _getSessionOptsFromConfig(optNames?: string[]): {};
    get fullId(): any;
    get publicAPI(): any;
    set sessionId(arg: any);
    get sessionId(): any;
    get config(): any;
    get state(): {
        isBroken: boolean;
    };
    get capabilities(): any;
    get callstackHistory(): import("./history/callstack") | null;
}
