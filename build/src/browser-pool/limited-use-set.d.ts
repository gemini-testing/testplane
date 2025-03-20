import debug from "debug";
/**
 * Set implementation which allows to get and put an object
 * there only limited amout of times. After limit is reached
 * attempt to put an object there causes the object to be finalized.
 */
export interface LimitedUseSetOpts<T> {
    useLimit: number;
    finalize: (value: T) => Promise<void>;
    formatItem: (value: T) => string;
}
export declare class LimitedUseSet<T extends object = object> {
    private _useCounts;
    private _useLimit;
    private _finalize;
    private _formatItem;
    private _objects;
    log: debug.Debugger;
    constructor(opts: LimitedUseSetOpts<T>);
    push(value: T): Promise<void>;
    private _isOverLimit;
    pop(): T | null;
}
