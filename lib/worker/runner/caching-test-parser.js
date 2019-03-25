'use strict';

const {EventEmitter} = require('events');
const {passthroughEvent} = require('gemini-core').events.utils;
const TestParser = require('../../test-reader/mocha-test-parser');
const TestCollection = require('../../test-collection');
const RunnerEvents = require('../constants/runner-events');

module.exports = class CachingTestParser extends EventEmitter {
    static create(...args) {
        return new this(...args);
    }

    constructor(config) {
        super();

        this._config = config;
        this._cache = {};

        TestParser.prepare();
    }

    parse({file, browserId}) {
        const cached = this._getFromCache({file, browserId});
        if (cached) {
            return cached;
        }

        const tests = this._parse({file, browserId});
        this._putToCache(tests, {file, browserId});
        this.emit(RunnerEvents.AFTER_TESTS_READ, TestCollection.create({[browserId]: tests}));

        return tests;
    }

    _getFromCache({file, browserId}) {
        return this._cache[browserId] && this._cache[browserId][file];
    }

    _putToCache(tests, {file, browserId}) {
        this._cache[browserId] = this._cache[browserId] || {};
        this._cache[browserId][file] = tests;
    }

    _parse({file, browserId}) {
        const parser = TestParser.create(browserId, this._config.forBrowser(browserId).system);

        passthroughEvent(parser, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ
        ]);

        return parser
            .loadFiles(file)
            .parse();
    }
};
