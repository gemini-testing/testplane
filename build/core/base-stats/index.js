"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
class BaseStats {
    constructor(statNames) {
        this._tests = new Set();
        this._retries = 0;
        this._statNames = statNames;
        this._stats = this._fillEmptyStats();
    }
    addPassed(test) {
        this._addStat(this._statNames.PASSED, test);
    }
    addFailed(test) {
        this._addStat(this._statNames.FAILED, test);
    }
    addSkipped(test) {
        this._addStat(this._statNames.SKIPPED, test);
    }
    addRetries() {
        this._retries++;
    }
    _addStat(stat, test, statsStorage = this._stats, testsStorage = this._tests) {
        const key = `${this._buildSuiteKey(test)} ${this._buildStateKey(test)}`;
        statsStorage[stat]++;
        testsStorage.add(key);
    }
    _fillEmptyStats() {
        const statValues = lodash_1.default.values(this._statNames);
        return lodash_1.default.zipObject(statValues, Array(statValues.length).fill(0));
    }
    getResult() {
        return lodash_1.default.extend(this._stats, {
            total: this._tests.size,
            retries: this._retries
        });
    }
}
exports.default = BaseStats;
