class TreeBuilder {
    #traps;
    #filters;
    #rootSuite;

    constructor() {
        this.#traps = [];
        this.#filters = [];

        this.#rootSuite = null;
    }

    addSuite(suite, parent = null) {
        if (!this.#rootSuite) {
            this.#rootSuite = suite;
        }

        if (parent) {
            parent.addSuite(suite);
        }

        this.#applyTraps(suite);

        return this;
    }

    addTest(test, parent) {
        parent.addTest(test);
        this.#applyTraps(test);

        return this;
    }

    addBeforeEachHook(hook, parent) {
        parent.addBeforeEachHook(hook);

        return this;
    }

    addAfterEachHook(hook, parent) {
        parent.addAfterEachHook(hook);

        return this;
    }

    addTrap(fn) {
        this.#traps.push(fn);

        return this;
    }

    #applyTraps(obj) {
        this.#traps.forEach((trap) => trap(obj));
        this.#traps = [];
    }

    addTestFilter(fn) {
        this.#filters.push(fn);

        return this;
    }

    applyFilters() {
        if (this.#rootSuite && this.#filters.length !== 0) {
            this.#rootSuite.filterTests((test) => {
                return this.#filters.every((f) => f(test));
            });
        }

        return this;
    }

    getRootSuite() {
        return this.#rootSuite;
    }
}

module.exports = {
    TreeBuilder
};
