import { Hook, Suite, Test } from "./test-object";

export type TrapFn = (test: Test | Suite) => void;
export type FilterFn = (test: Test) => boolean;

export class TreeBuilder {
    #traps: TrapFn[];
    #filters: FilterFn[];
    #rootSuite: Suite | null;

    constructor() {
        this.#traps = [];
        this.#filters = [];

        this.#rootSuite = null;
    }

    addSuite(suite: Suite, parent: Suite | null = null): TreeBuilder {
        if (!this.#rootSuite) {
            this.#rootSuite = suite;
        }

        if (parent) {
            parent.addSuite(suite);
        }

        this.#applyTraps(suite);

        return this;
    }

    addTest(test: Test, parent: Suite): TreeBuilder {
        parent.addTest(test);
        this.#applyTraps(test);

        return this;
    }

    addBeforeEachHook(hook: Hook, parent: Suite): TreeBuilder {
        parent.addBeforeEachHook(hook);

        return this;
    }

    addAfterEachHook(hook: Hook, parent: Suite): TreeBuilder {
        parent.addAfterEachHook(hook);

        return this;
    }

    addTrap(fn: TrapFn): TreeBuilder {
        this.#traps.push(fn);

        return this;
    }

    #applyTraps(obj: Test | Suite): void {
        this.#traps.forEach(trap => trap(obj));
        this.#traps = [];
    }

    addTestFilter(fn: FilterFn): TreeBuilder {
        this.#filters.push(fn);

        return this;
    }

    applyFilters(): TreeBuilder {
        if (this.#rootSuite && this.#filters.length !== 0) {
            this.#rootSuite.filterTests(test => {
                return this.#filters.every(f => f(test));
            });
        }

        return this;
    }

    getRootSuite(): Suite | null {
        return this.#rootSuite;
    }
}
