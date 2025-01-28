export = Callstack;
declare class Callstack {
    _history: any[];
    _stack: any[];
    enter(data: any): void;
    leave(key: any): void;
    markError(shouldPropagateFn: any): void;
    release(): any[];
}
