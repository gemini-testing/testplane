export = LimitedUseSet;
declare class LimitedUseSet {
    constructor(opts: any);
    _useCounts: WeakMap<object, any>;
    _useLimit: any;
    _finalize: any;
    _formatItem: any;
    _objects: any[];
    log: any;
    push(value: any): any;
    _isOverLimit(value: any): boolean;
    pop(): any;
}
