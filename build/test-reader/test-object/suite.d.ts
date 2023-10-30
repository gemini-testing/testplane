export class Suite extends ConfigurableTestObject {
    constructor({ title, file, id }?: {
        title: any;
        file: any;
        id: any;
    });
    addSuite(suite: any): Suite;
    addTest(test: any): Suite;
    addBeforeEachHook(hook: any): Suite;
    addAfterEachHook(hook: any): Suite;
    beforeEach(fn: any): Suite;
    afterEach(fn: any): Suite;
    eachTest(cb: any): void;
    getTests(): any[];
    filterTests(cb: any): Suite;
    get root(): boolean;
    get suites(): any[];
    get tests(): any[];
    get beforeEachHooks(): any[];
    get afterEachHooks(): any[];
    #private;
}
import { ConfigurableTestObject } from "./configurable-test-object";
