'use strict';

const AsyncEmitter = require('gemini-core').events.AsyncEmitter;
const eventsUtils = require('gemini-core').events.utils;
const RunnerEvents = require('../constants/runner-events');
const BrowserPool = require('./browser-pool');
const BrowserAgent = require('./browser-agent');
const MochaAdapter = require('./mocha-adapter');

module.exports = class Runner extends AsyncEmitter {
    static create(config) {
        return new Runner(config);
    }

    constructor(config) {
        super();

        this._config = config;
        this._browserPool = BrowserPool.create(this._config, this);

        MochaAdapter.prepare();
    }

    runTest(fullTitle, options) {
        return this._createMocha(fullTitle, options.file, options.browserId)
            .runInSession(options.sessionId);
    }

    _createMocha(fullTitle, file, browserId) {
        const browserAgent = BrowserAgent.create(browserId, this._browserPool);
        const config = Object.assign({}, this._config.system, this._config.forBrowser(browserId));
        const mocha = MochaAdapter.create(browserAgent, config);

        eventsUtils.passthroughEvent(mocha, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ
        ]);

        mocha.attachTestFilter((test) => test.fullTitle() === fullTitle);
        mocha.loadFiles(file);

        return mocha;
    }
};
