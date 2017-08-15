'use strict';

const EventEmitter = require('events').EventEmitter;
const _ = require('lodash');
const qUtils = require('qemitter/utils');

const RunnerEvents = require('../../constants/runner-events');
const MochaBuilder = require('./mocha-builder');

module.exports = class MochaRunner extends EventEmitter {
    static prepare() {
        MochaBuilder.prepare();
    }

    static create(browserId, config, browserPool) {
        return new MochaRunner(browserId, config, browserPool);
    }

    constructor(browserId, config, browserPool) {
        super();

        this._config = config.forBrowser(browserId);
        this._mochaBuilder = MochaBuilder.create(browserId, config.system, browserPool);

        qUtils.passthroughEvent(this._mochaBuilder, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ
        ]);
    }

    init(filepaths) {
        this._mochas = this._mochaBuilder.buildAdapters(filepaths);

        return this;
    }

    runTest(fullTitle, sessionId) {
        const index = _.findIndex(this._mochas, (mocha) => {
            const titles = mocha ? mocha.tests.map((test) => test.fullTitle()) : [];

            return _.includes(titles, fullTitle);
        });

        return this._mochas[index].runInSession(sessionId)
            .then(() => this._mochas[index] = null); // leave instance for retries in case of error
    }
};
