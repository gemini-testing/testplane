import { Suite, Test, Hook } from "../test-object/index.js";
import crypto from "../../utils/crypto.js";

export class TreeBuilderDecorator {
    #treeBuilder;
    #suiteMap;
    #suiteCounter;

    static create(...args) {
        return new this(...args);
    }

    constructor(treeBuilder) {
        this.#treeBuilder = treeBuilder;
        this.#suiteMap = new Map();
        this.#suiteCounter = new Map();
    }

    addSuite(mochaSuite) {
        const { id: mochaId, file } = mochaSuite;
        const positionInFile = this.#suiteCounter.get(file) || 0;
        const id = mochaSuite.root ? mochaId : crypto.getShortMD5(file) + positionInFile;
        const suite = this.#mkTestObject(Suite, mochaSuite, { id });

        this.#applyConfig(suite, mochaSuite);
        this.#treeBuilder.addSuite(suite, this.#getParent(mochaSuite, null));
        this.#suiteMap.set(mochaId, suite);
        this.#suiteCounter.set(file, positionInFile + 1);

        return this;
    }

    addTest(mochaTest) {
        const { fn } = mochaTest;
        const id = crypto.getShortMD5(mochaTest.fullTitle());
        const test = this.#mkTestObject(Test, mochaTest, { id, fn });

        this.#applyConfig(test, mochaTest);
        this.#treeBuilder.addTest(test, this.#getParent(mochaTest));

        return this;
    }

    addBeforeEachHook(mochaHook) {
        return this.#addHook(mochaHook, (hook, parent) => this.#treeBuilder.addBeforeEachHook(hook, parent));
    }

    addAfterEachHook(mochaHook) {
        return this.#addHook(mochaHook, (hook, parent) => this.#treeBuilder.addAfterEachHook(hook, parent));
    }

    #addHook(mochaHook, cb) {
        const { fn, title } = mochaHook;
        const hook = Hook.create({ fn, title });

        cb(hook, this.#getParent(mochaHook));

        return this;
    }

    #mkTestObject(Constructor, mochaObject, customOpts) {
        const { title, file } = mochaObject;
        return Constructor.create({ title, file, ...customOpts });
    }

    #applyConfig(testObject, mochaObject) {
        const { pending, parent } = mochaObject;

        if (!parent || mochaObject.timeout() !== parent.timeout()) {
            testObject.timeout = mochaObject.timeout();
        }

        if (pending) {
            testObject.skip({ reason: "Skipped by mocha interface" });
        }
    }

    #getParent({ parent }, defaultValue) {
        if (!parent) {
            if (defaultValue !== undefined) {
                return defaultValue;
            }

            throw new Error("Parent not set");
        }

        return this.#suiteMap.get(parent.id);
    }

    addTrap(fn) {
        this.#treeBuilder.addTrap(fn);

        return this;
    }

    addTestFilter(fn) {
        this.#treeBuilder.addTestFilter(fn);

        return this;
    }

    applyFilters() {
        this.#treeBuilder.applyFilters();

        return this;
    }

    getRootSuite() {
        return this.#treeBuilder.getRootSuite();
    }
}
