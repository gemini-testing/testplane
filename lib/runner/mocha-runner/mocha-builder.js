'use strict';

const EventEmitter = require('events').EventEmitter;
const BrowserAgent = require('gemini-core').BrowserAgent;
const _ = require('lodash');
const eventsUtils = require('gemini-core').events.utils;
const {Test} = require('mocha');
const RunnerEvents = require('../../constants/runner-events');
const MochaAdapter = require('./mocha-adapter');
const SingleTestMochaAdapter = require('./single-test-mocha-adapter');

module.exports = class MochaBuilder extends EventEmitter {
    static prepare() {
        MochaAdapter.prepare();
    }

    static create(browserId, config, browserPool, testSkipper) {
        return new MochaBuilder(browserId, config, browserPool, testSkipper);
    }

    constructor(browserId, config, browserPool, testSkipper) {
        super();

        this._browserId = browserId;
        this._config = config;
        this._browserPool = browserPool;
        this._testSkipper = testSkipper;
    }

    buildAdapters(sources) {
        const mkAdapters = (source, testIndex) => {
            testIndex = testIndex || 0;

            const mocha = SingleTestMochaAdapter.create(this._createMocha(), source, testIndex);

            return mocha.tests.length ? [mocha].concat(mkAdapters(source, testIndex + 1)) : [];
        };

        return _(sources)
            .map((source) => {
                return source instanceof Test
                    ? SingleTestMochaAdapter.create(this._createMocha(), source)
                    : mkAdapters(source);
            })
            .flatten()
            .value();
    }

    buildSingleAdapter(filenames) {
        return this._createMocha().loadFiles(filenames);
    }

    _createMocha() {
        const browserAgent = BrowserAgent.create(this._browserId, this._browserPool);
        const mocha = MochaAdapter.create(browserAgent, this._config);

        eventsUtils.passthroughEvent(mocha, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ
        ]);

        return mocha.applySkip(this._testSkipper);
    }
};
