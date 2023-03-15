const { ConfigurableTestObject } = require("./configurable-test-object");
const { Hook } = require("./hook");
const _ = require("lodash");

class Suite extends ConfigurableTestObject {
    #suites;
    #tests;
    #beforeEachHooks;
    #afterEachHooks;

    constructor({ title, file, id } = {}) {
        super({ title, file, id });

        this.#suites = [];
        this.#tests = [];
        this.#beforeEachHooks = [];
        this.#afterEachHooks = [];
    }

    addSuite(suite) {
        return this.#addChild(suite, this.#suites);
    }

    addTest(test) {
        return this.#addChild(test, this.#tests);
    }

    addBeforeEachHook(hook) {
        return this.#addChild(hook, this.#beforeEachHooks);
    }

    addAfterEachHook(hook) {
        return this.#addChild(hook, this.#afterEachHooks);
    }

    beforeEach(fn) {
        return this.addBeforeEachHook(Hook.create({ title: '"before each" hook', fn }));
    }

    afterEach(fn) {
        return this.addAfterEachHook(Hook.create({ title: '"after each" hook', fn }));
    }

    #addChild(child, storage) {
        child.parent = this;
        storage.push(child);

        return this;
    }

    eachTest(cb) {
        this.#tests.forEach(t => cb(t));
        this.#suites.forEach(s => s.eachTest(cb));
    }

    getTests() {
        return this.#tests.concat(_.flatten(this.#suites.map(s => s.getTests())));
    }

    // Modifies tree
    filterTests(cb) {
        this.#tests = this.#tests.filter(cb);

        this.#suites.forEach(s => s.filterTests(cb));
        this.#suites = this.#suites.filter(s => s.getTests().length !== 0);

        return this;
    }

    get root() {
        return this.parent === null;
    }

    get suites() {
        return this.#suites;
    }

    get tests() {
        return this.#tests;
    }

    get beforeEachHooks() {
        return this.#beforeEachHooks;
    }

    get afterEachHooks() {
        return this.#afterEachHooks;
    }
}

module.exports = {
    Suite,
};
