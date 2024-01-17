"use strict";
const { EventEmitter } = require("events");
const { passthroughEvent } = require("../../events/utils");
const SequenceTestParser = require("./sequence-test-parser");
const { TestCollection } = require("../../test-collection");
const { WorkerEvents } = require("../../events");
module.exports = class CachingTestParser extends EventEmitter {
    static create(...args) {
        return new this(...args);
    }
    constructor(config) {
        super();
        this._config = config;
        this._cache = {};
        this._sequenceTestParser = SequenceTestParser.create(config);
        passthroughEvent(this._sequenceTestParser, this, [WorkerEvents.BEFORE_FILE_READ, WorkerEvents.AFTER_FILE_READ]);
    }
    async parse({ file, browserId }) {
        const cached = this._getFromCache({ file, browserId });
        if (cached) {
            return cached;
        }
        const testsPromise = this._sequenceTestParser.parse({ file, browserId });
        this._putToCache(testsPromise, { file, browserId });
        const tests = await testsPromise;
        this.emit(WorkerEvents.AFTER_TESTS_READ, TestCollection.create({ [browserId]: tests }, this._config));
        return tests;
    }
    _getFromCache({ file, browserId }) {
        return this._cache[browserId] && this._cache[browserId][file];
    }
    _putToCache(testsPromise, { file, browserId }) {
        this._cache[browserId] = this._cache[browserId] || {};
        this._cache[browserId][file] = testsPromise;
    }
};
//# sourceMappingURL=caching-test-parser.js.map