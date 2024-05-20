import _ from "lodash";
import { ConfigurableTestObject } from "./configurable-test-object";
import { Hook } from "./hook";
import { Test } from "./test";
import type { TestObjectData, ConfigurableTestObjectData, TestFunction, TestFunctionCtx } from "./types";

type SuiteOpts = Pick<ConfigurableTestObjectData, "file" | "id"> & TestObjectData;

export class Suite extends ConfigurableTestObject {
    #suites: this[];
    #tests: Test[];
    #beforeEachHooks: Hook[];
    #afterEachHooks: Hook[];

    static create<T extends Suite>(this: new (opts: SuiteOpts) => T, opts: SuiteOpts): T {
        return new this(opts);
    }

    // used inside test
    constructor({ title, file, id }: SuiteOpts = {} as SuiteOpts) {
        super({ title, file, id });

        this.#suites = [];
        this.#tests = [];
        this.#beforeEachHooks = [];
        this.#afterEachHooks = [];
    }

    addSuite(suite: Suite): this {
        return this.#addChild(suite, this.#suites);
    }

    addTest(test: Test): this {
        return this.#addChild(test, this.#tests);
    }

    addBeforeEachHook(hook: Hook): this {
        return this.#addChild(hook, this.#beforeEachHooks);
    }

    addAfterEachHook(hook: Hook): this {
        return this.#addChild(hook, this.#afterEachHooks);
    }

    beforeEach(fn: TestFunction<TestFunctionCtx>): this {
        return this.addBeforeEachHook(Hook.create({ title: '"before each" hook', fn }));
    }

    afterEach(fn: TestFunction<TestFunctionCtx>): this {
        return this.addAfterEachHook(Hook.create({ title: '"after each" hook', fn }));
    }

    #addChild(child: Suite | Hook | Test, storage: (Suite | Hook | Test)[]): this {
        child.parent = this;
        storage.push(child);

        return this;
    }

    eachTest(cb: (test: Test) => void): void {
        this.#tests.forEach(t => cb(t));
        this.#suites.forEach(s => s.eachTest(cb));
    }

    getTests(): Test[] {
        return this.#tests.concat(_.flatten(this.#suites.map(s => s.getTests())));
    }

    // Modifies tree
    filterTests(cb: (test: Test) => unknown): this {
        this.#tests = this.#tests.filter(cb);

        this.#suites.forEach(s => s.filterTests(cb));
        this.#suites = this.#suites.filter(s => s.getTests().length !== 0);

        return this;
    }

    get root(): boolean {
        return this.parent === null;
    }

    get suites(): Suite[] {
        return this.#suites;
    }

    get tests(): Test[] {
        return this.#tests;
    }

    get beforeEachHooks(): Hook[] {
        return this.#beforeEachHooks;
    }

    get afterEachHooks(): Hook[] {
        return this.#afterEachHooks;
    }
}
