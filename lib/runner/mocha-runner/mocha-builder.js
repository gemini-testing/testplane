'use strict';

const EventEmitter = require('events').EventEmitter;
const BrowserAgent = require('gemini-core').BrowserAgent;
const _ = require('lodash');
const qUtils = require('qemitter/utils');
const RunnerEvents = require('../../constants/runner-events');
const MochaAdapter = require('./mocha-adapter');
const SingleTestMochaAdapter = require('./single-test-mocha-adapter');

module.exports = class MochaBuilder extends EventEmitter {
    static create(browserId, config, browserPool, testSkipper) {
        return new MochaBuilder(browserId, config, browserPool, testSkipper);
    }

    constructor(browserId, config, browserPool, testSkipper) {
        super();

        this._browserId = browserId;
        this._sharedMochaOpts = config.mochaOpts;
        this._ctx = _.clone(config.ctx);
        this._browserPool = browserPool;
        this._testSkipper = testSkipper;
    }

    buildAdapters(filenames) {
        const mkAdapters = (filename, testIndex) => {
            testIndex = testIndex || 0;

            const mocha = SingleTestMochaAdapter.create(this._createMocha(), filename, testIndex);

            return mocha.tests.length ? [mocha].concat(mkAdapters(filename, testIndex + 1)) : [];
        };

        return _(filenames)
            .map((filename) => mkAdapters(filename))
            .flatten()
            .value();
    }

    buildSingleAdapter(filenames) {
        return this._createMocha().loadFiles(filenames);
    }

    _createMocha() {
        const browserAgent = BrowserAgent.create(this._browserId, this._browserPool);
        const mocha = MochaAdapter.create(this._sharedMochaOpts, browserAgent, this._ctx);

        qUtils.passthroughEvent(mocha, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ
        ]);

        return mocha.applySkip(this._testSkipper);
    }
};
