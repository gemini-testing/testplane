import _ from "lodash";

import type { Suite, RootSuite, Test } from "./types/index.js";

type TestDisabled = Test & { disabled: true };
type TestsCallback<T> = (test: Test, browserId: string) => T;
type SortTestsCallback = (test1: Test, test2: Test) => number;

export class TestCollection {
    readonly #specs: Record<string, Test[]>;
    readonly #originalSpecs: Record<string, Test[]>;

    static create<T extends TestCollection>(
        this: new (specs: Record<string, Test[]>) => T,
        specs: Record<string, Test[]>,
    ): T {
        return new this(specs);
    }

    constructor(specs: Record<string, Test[]>) {
        this.#originalSpecs = specs;
        this.#specs = _.mapValues(specs, _.clone);
    }

    getRootSuite(browserId: string): RootSuite {
        const test = this.#originalSpecs[browserId][0];
        return test && test.parent && this.#getRoot(test.parent);
    }

    eachRootSuite(cb: (root: RootSuite, browserId: string) => void): void {
        _.forEach(this.#specs, (_, browserId) => {
            const root = this.getRootSuite(browserId);
            if (root) {
                cb(root, browserId);
            }
        });
    }

    #getRoot(suite: Suite): RootSuite {
        return suite.root ? (suite as RootSuite) : this.#getRoot(suite.parent);
    }

    getBrowsers(): string[] {
        return Object.keys(this.#specs);
    }

    mapTests<T>(cb: TestsCallback<T>): T[];
    mapTests<T>(browserId: string | undefined, cb: TestsCallback<T>): T[];
    mapTests<T>(browserId: string | TestsCallback<T> | undefined, cb?: TestsCallback<T>): T[] {
        if (_.isFunction(browserId)) {
            cb = browserId;
            browserId = undefined;
        }

        const results: T[] = [];
        this.eachTest(browserId, (test: Test, browserId: string) =>
            results.push((cb as TestsCallback<T>)(test, browserId)),
        );

        return results;
    }

    sortTests(callback: SortTestsCallback): this;
    sortTests(browserId: string | undefined, callback: SortTestsCallback): this;

    sortTests(browserId: string | SortTestsCallback | undefined, cb?: SortTestsCallback): this {
        if (_.isFunction(browserId)) {
            cb = browserId;
            browserId = undefined;
        }

        if (browserId) {
            if (this.#specs[browserId]?.length && this.#originalSpecs[browserId]?.length) {
                const pairs = _.zip(this.#specs[browserId], this.#originalSpecs[browserId]) as [Test, Test][];

                pairs.sort((p1, p2) => (cb as SortTestsCallback)(p1[0], p2[0]));

                [this.#specs[browserId], this.#originalSpecs[browserId]] = _.unzip(pairs);
            }
        } else {
            this.getBrowsers().forEach(browserId => this.sortTests(browserId, cb as SortTestsCallback));
        }

        return this;
    }

    eachTest(callback: TestsCallback<void>): void;
    eachTest(browserId: string | undefined, callback: TestsCallback<void>): void;
    eachTest(browserId: string | TestsCallback<void> | undefined, cb?: TestsCallback<void>): void {
        if (_.isFunction(browserId)) {
            cb = browserId;
            browserId = undefined;
        }

        if (browserId) {
            this.#specs[browserId].forEach(test => (cb as TestsCallback<void>)(test, browserId as string));
        } else {
            this.getBrowsers().forEach(browserId => this.eachTest(browserId, cb as TestsCallback<void>));
        }
    }

    eachTestByVersions(browserId: string, cb: (test: Test, browserId: string, browserVersion: string) => void): void {
        const groups = _.groupBy(this.#specs[browserId], "browserVersion");
        const versions = Object.keys(groups);
        const maxLength =
            _(groups)
                .map(tests => tests.length)
                .max() || 0;

        for (let idx = 0; idx < maxLength; ++idx) {
            for (const version of versions) {
                const group = groups[version];
                const test = group[idx];

                if (test) {
                    cb(test, browserId, test.browserVersion);
                }
            }
        }
    }

    disableAll(browserId?: string): this {
        if (browserId) {
            this.#specs[browserId] = this.#originalSpecs[browserId].map(test => this.#mkDisabledTest(test));
        } else {
            this.getBrowsers().forEach(browserId => this.disableAll(browserId));
        }

        return this;
    }

    #mkDisabledTest(test: Test): TestDisabled {
        return _.extend(test.clone(), { disabled: true });
    }

    disableTest(fullTitle: string, browserId?: string): this {
        if (browserId) {
            const idx = this.#findTestIndex(fullTitle, browserId);
            if (idx !== -1) {
                this.#specs[browserId].splice(idx, 1, this.#mkDisabledTest(this.#originalSpecs[browserId][idx]));
            }
        } else {
            this.getBrowsers().forEach(browserId => this.disableTest(fullTitle, browserId));
        }

        return this;
    }

    #findTestIndex(fullTitle: string, browserId: string): number {
        return this.#specs[browserId].findIndex(test => test.fullTitle() === fullTitle);
    }

    enableAll(browserId?: string): this {
        if (browserId) {
            this.#specs[browserId] = _.clone(this.#originalSpecs[browserId]);
        } else {
            this.getBrowsers().forEach(browserId => this.enableAll(browserId));
        }

        return this;
    }

    enableTest(fullTitle: string, browserId?: string): this {
        if (browserId) {
            const idx = this.#findTestIndex(fullTitle, browserId);
            if (idx !== -1) {
                this.#specs[browserId].splice(idx, 1, this.#originalSpecs[browserId][idx]);
            }
        } else {
            this.getBrowsers().forEach(browserId => this.enableTest(fullTitle, browserId));
        }

        return this;
    }
}
