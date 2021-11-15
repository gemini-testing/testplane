import _ from 'lodash';

import type { Suite, Test } from './types/mocha';

type Specs = {
    [browserId: string]: Array<Test>;
};

export default class TestCollection {
    private _originalSpecs: Specs;
    private _specs: Specs;

    public static create(specs: Specs): TestCollection {
        return new this(specs);
    }

    constructor(specs: Specs) {
        this._originalSpecs = specs;
        this._specs = _.mapValues(specs, _.clone);
    }

    public getRootSuite(browserId: string): Suite | undefined {
        const test = this._originalSpecs[browserId][0];

        return test && test.parent && this._getRoot(test.parent);
    }

    public eachRootSuite(cb: (rootSuite: Suite, browserId: string) => void): void {
        _.forEach(this._specs, (tests, browserId) => {
            const root = this.getRootSuite(browserId);

            if (root) {
                cb(root, browserId);
            }
        });
    }

    private _getRoot(suite: Suite): Suite {
        return suite.root ? suite : this._getRoot(suite.parent as Suite);
    }

    public getBrowsers(): Array<string> {
        return Object.keys(this._specs);
    }

    public mapTests<T>(cb: (test: Test, browserId: string) => T): Array<T>;
    public mapTests<T>(browserId: string, cb: (test: Test, browserId: string) => T): Array<T>;
    public mapTests<T>(
        browserId: string | ((test: Test, browserId: string) => T),
        cb?: (test: Test, browserId: string) => T
    ): Array<T> {
        const [id, callback] = resolveArgs(browserId, cb);
        const results: Array<T> = [];
        if (id) {
            this.eachTest(id, (test, browserId) => results.push(callback(test, browserId)));
        } else {
            this.eachTest((test, browserId) => results.push(callback(test, browserId)));
        }

        return results;
    }

    public sortTests(cb: (t1: Test, t2: Test) => number): this;
    public sortTests(browserId: string, cb: (t1: Test, t2: Test) => number): this;
    public sortTests(
        browserId: string | ((t1: Test, t2: Test) => number),
        cb?: (t1: Test, t2: Test) => number
    ): this {
        const [id, callback] = resolveArgs(browserId, cb);

        if (id) {
            if (this._specs[id].length) {
                let pairs = _.zip(this._specs[id], this._originalSpecs[id]) as Array<[Test, Test]>;

                pairs.sort((p1, p2) => callback(p1[0], p2[0]));

                [this._specs[id], this._originalSpecs[id]] = _.unzip(pairs);
            }
        } else {
            this.getBrowsers().forEach((browserId) => this.sortTests(browserId, callback));
        }

        return this;
    }

    public eachTest(cb: (test: Test, browserId: string) => void): void;
    public eachTest(browserId: string, cb: (test: Test, browserId: string) => void): void;
    public eachTest(
        browserId: string | ((test: Test, browserId: string) => void),
        cb?: (test: Test, browserId: string) => void
    ): void {
        const [id, callback] = resolveArgs(browserId, cb);

        if (id) {
            this._specs[id].forEach((test) => callback(test, id));
        } else {
            this.getBrowsers().forEach((id) => this.eachTest(id, callback));
        }
    }

    public eachTestByVersions(
        browserId: string,
        cb: (test: Test, browserId: string, browserVersion?: string) => void
    ): void {
        const groups = _.groupBy(this._specs[browserId], 'browserVersion');
        const versions = Object.keys(groups);
        const maxLength = _(groups)
            .map((tests) => tests.length)
            .max() as number;

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

    public disableAll(browserId?: string): this {
        if (browserId) {
            this._specs[browserId] = this._originalSpecs[browserId].map((test) => this._mkDisabledTest(test));
        } else {
            this.getBrowsers().forEach((browserId) => this.disableAll(browserId));
        }

        return this;
    }

    private _mkDisabledTest(test: Test): Test {
        return _.extend(Object.create(test), {disabled: true});
    }

    public disableTest(fullTitle: string, browserId?: string): this {
        if (browserId) {
            const idx = this._findTestIndex(fullTitle, browserId);
            if (idx !== -1) {
                this._specs[browserId].splice(idx, 1, this._mkDisabledTest(this._originalSpecs[browserId][idx]));
            }
        } else {
            this.getBrowsers().forEach((browserId) => this.disableTest(fullTitle, browserId));
        }

        return this;
    }

    private _findTestIndex(fullTitle: string, browserId: string): number {
        return this._specs[browserId].findIndex((test) => test.fullTitle() === fullTitle);
    }

    public enableAll(browserId?: string): this {
        if (browserId) {
            this._specs[browserId] = _.clone(this._originalSpecs[browserId]);
        } else {
            this.getBrowsers().forEach((browserId) => this.enableAll(browserId));
        }

        return this;
    }

    public enableTest(fullTitle: string, browserId?: string): this {
        if (browserId) {
            const idx = this._findTestIndex(fullTitle, browserId);
            if (idx !== -1) {
                this._specs[browserId].splice(idx, 1, this._originalSpecs[browserId][idx]);
            }
        } else {
            this.getBrowsers().forEach((browserId) => this.enableTest(fullTitle, browserId));
        }

        return this;
    }
};

function resolveArgs<A extends string, B extends (...args: Array<any>) => any>(v1: A | B, v2?: B): [A | undefined, B] {
    if (_.isFunction(v1)) {
        return [undefined, v1];
    }

    return [v1, v2 as B];
}
