'use strict';

const EventEmitter = require('events').EventEmitter;
const _ = require('lodash');
const qUtils = require('qemitter/utils');
const RunnerEvents = require('../../../constants/runner-events');

module.exports = class BaseMochaBuilder extends EventEmitter {
    static create(browserId, config, browserPool, testSkipper) {
        return new this(browserId, config, browserPool, testSkipper);
    }

    constructor(browserId, config, browserPool, testSkipper, modules) {
        super();

        this._browserId = browserId;
        this._config = config;
        this._browserPool = browserPool;
        this._testSkipper = testSkipper;
        this._modules = modules;
    }

    buildAdapters(filenames) {
        const mkAdapters = (filename, testIndex) => {
            testIndex = testIndex || 0;

            const mocha = this._modules.SingleTestMochaAdapter.create(this._createMocha(), filename, testIndex);

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
        const browserAgent = this._modules.BrowserAgent.create(this._browserId, this._browserPool);
        const mocha = this._modules.MochaAdapter.create(browserAgent, this._config);

        qUtils.passthroughEvent(mocha, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ
        ]);

        return mocha.applySkip(this._testSkipper);
    }
};
