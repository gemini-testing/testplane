export declare class MochaWrapper {
    private _runnables;
    private _parser;
    private _socket;
    static create<T extends MochaWrapper>(this: new () => T): T;
    constructor();
    init(): Promise<void>;
    private _validate;
    private _subscribeOnWorkerMessages;
}
