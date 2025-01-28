import { Hook, Suite, Test } from "./test-object";
export type TrapFn = (test: Test | Suite) => void;
export type FilterFn = (test: Test) => boolean;
export declare class TreeBuilder {
    #private;
    constructor();
    addSuite(suite: Suite, parent?: Suite | null): TreeBuilder;
    addTest(test: Test, parent: Suite): TreeBuilder;
    addBeforeEachHook(hook: Hook, parent: Suite): TreeBuilder;
    addAfterEachHook(hook: Hook, parent: Suite): TreeBuilder;
    addTrap(fn: TrapFn): TreeBuilder;
    addTestFilter(fn: FilterFn): TreeBuilder;
    applyFilters(): TreeBuilder;
    getRootSuite(): Suite | null;
}
