'use strict';

const EventEmitter = require('events').EventEmitter;
const eventsUtils = require('gemini-core').events.utils;
const RunnerEvents = require('../../constants/runner-events');
const MochaAdapter = require('./mocha-adapter');

module.exports = class MochaBuilder extends EventEmitter {
    static prepare() {
        MochaAdapter.prepare();
    }

    static create(...args) {
        return new MochaBuilder(...args);
    }

    constructor(browserId, config, testSkipper) {
        super();

        this._browserId = browserId;
        this._config = config;
        this._testSkipper = testSkipper;
    }

    buildSingleAdapter(filenames) {
        const mocha = MochaAdapter.create(this._browserId, this._config);

        eventsUtils.passthroughEvent(mocha, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ
        ]);

        return mocha
            .applySkip(this._testSkipper)
            .loadFiles(filenames);
    }
};
