'use strict';

const EventEmitter = require('events').EventEmitter;
const _ = require('lodash');
const qUtils = require('qemitter/utils');
const BrowserAgent = require('../../browser-agent');
const RunnerEvents = require('../../constants/runner-events');
const MochaAdapter = require('./mocha-adapter');
const SingleTestMochaAdapter = require('./single-test-mocha-adapter');

module.exports = class MochaBuilder extends EventEmitter {
    static prepare() {
        MochaAdapter.prepare();
    }

    static create(browserId, config, browserPool) {
        return new MochaBuilder(browserId, config, browserPool);
    }

    constructor(browserId, config, browserPool) {
        super();

        this._browserId = browserId;
        this._config = config;
        this._browserPool = browserPool;
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

    _createMocha() {
        const browserAgent = BrowserAgent.create(this._browserId, this._browserPool);
        const mocha = MochaAdapter.create(browserAgent, this._config);

        qUtils.passthroughEvent(mocha, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ
        ]);

        return mocha;
    }
};
