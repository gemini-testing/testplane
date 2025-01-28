"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CachingTestParser = void 0;
const events_1 = require("events");
const utils_1 = require("../../events/utils");
const sequence_test_parser_1 = require("./sequence-test-parser");
const test_collection_1 = require("../../test-collection");
const events_2 = require("../../events");
class CachingTestParser extends events_1.EventEmitter {
    static create(...args) {
        return new this(...args);
    }
    constructor(config) {
        super();
        this._cache = {};
        this._sequenceTestParser = sequence_test_parser_1.SequenceTestParser.create(config);
        (0, utils_1.passthroughEvent)(this._sequenceTestParser, this, [events_2.WorkerEvents.BEFORE_FILE_READ, events_2.WorkerEvents.AFTER_FILE_READ]);
    }
    async parse({ file, browserId }) {
        const cached = this._getFromCache({ file, browserId });
        if (cached) {
            return cached;
        }
        const testsPromise = this._sequenceTestParser.parse({ file, browserId });
        this._putToCache(testsPromise, { file, browserId });
        const tests = await testsPromise;
        this.emit(events_2.WorkerEvents.AFTER_TESTS_READ, test_collection_1.TestCollection.create({ [browserId]: tests }));
        return tests;
    }
    _getFromCache({ file, browserId }) {
        return this._cache[browserId] && this._cache[browserId][file];
    }
    _putToCache(testsPromise, { file, browserId }) {
        this._cache[browserId] = this._cache[browserId] || {};
        this._cache[browserId][file] = testsPromise;
    }
}
exports.CachingTestParser = CachingTestParser;
//# sourceMappingURL=caching-test-parser.js.map