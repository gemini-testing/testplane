import { TestStepKey, TestStep } from "../../types";
export declare class Callstack {
    private _history;
    private _stack;
    constructor();
    enter(data: Omit<TestStep, TestStepKey.TimeStart | TestStepKey.Children>): void;
    leave(key: symbol): void;
    markError(shouldPropagateFn: (parentNode: TestStep, currentNode: TestStep) => boolean): void;
    release(): TestStep[];
}
