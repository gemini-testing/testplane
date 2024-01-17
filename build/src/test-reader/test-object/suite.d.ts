export class Suite extends ConfigurableTestObject {
    constructor({ title, file, id }?: {
        title: any;
        file: any;
        id: any;
    });
    addSuite(suite: any): this;
    addTest(test: any): this;
    addBeforeEachHook(hook: any): this;
    addAfterEachHook(hook: any): this;
    beforeEach(fn: any): this;
    afterEach(fn: any): this;
    eachTest(cb: any): void;
    getTests(): any[];
    filterTests(cb: any): this;
    get root(): boolean;
    get suites(): any[];
    get tests(): any[];
    get beforeEachHooks(): any[];
    get afterEachHooks(): any[];
    #private;
}
import { ConfigurableTestObject } from "./configurable-test-object";
