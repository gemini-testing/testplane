import _ from 'lodash';

export type Values<T> = T[keyof T] extends string ? T[keyof T] : never;

type StatNames = {
    PASSED: "passed";
    FAILED: "failed";
    SKIPPED: "skipped";
};

type TestsStats<T> = Record<Values<T>, number>;

type StatsResult<T> = TestsStats<T> & {
    total: number;
    retries: number;
};

export default abstract class BaseStats<T extends StatNames = StatNames> {
    private _tests: Set<string>;
    private _retries: number;
    private _statNames: T;
    private _stats: TestsStats<T>;

    constructor(statNames: T) {
        this._tests = new Set();
        this._retries = 0;
        this._statNames = statNames;

        this._stats = this._fillEmptyStats();
    }

    addPassed(test: unknown): void {
        this._addStat(this._statNames.PASSED as Values<T>, test);
    }

    addFailed(test: unknown): void {
        this._addStat(this._statNames.FAILED as Values<T>, test);
    }

    addSkipped(test: unknown): void {
        this._addStat(this._statNames.SKIPPED as Values<T>, test);
    }

    addRetries(): void {
        this._retries++;
    }

    protected _addStat(
        stat: Values<T>,
        test: unknown,
        statsStorage: TestsStats<T> = this._stats,
        testsStorage: Set<string> = this._tests
    ) {
        const key = `${this._buildSuiteKey(test)} ${this._buildStateKey(test)}`;

        statsStorage[stat]++;
        testsStorage.add(key);
    }

    protected _fillEmptyStats(): TestsStats<T> {
        const statValues = _.values(this._statNames);

        return _.zipObject(statValues, Array(statValues.length).fill(0)) as TestsStats<T>;
    }

    protected abstract _buildStateKey(_test: unknown): string;

    protected abstract _buildSuiteKey(_test: unknown): string;

    getResult(): StatsResult<T> {
        return _.extend(this._stats, {
            total: this._tests.size,
            retries: this._retries
        });
    }
}
