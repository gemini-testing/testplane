'use strict';

const EventEmitter = require('events').EventEmitter;
const _ = require('lodash');
const qUtils = require('qemitter/utils');
const RunnerEvents = require('../../constants/runner-events');
const MochaAdapter = require('./mocha-adapter');

module.exports = class MochaBuilder extends EventEmitter {
    static create(config, browserAgent, testSkipper) {
        return new MochaBuilder(config, browserAgent, testSkipper);
    }

    constructor(config, browserAgent, testSkipper) {
        super();

        this._sharedMochaOpts = config.mochaOpts;
        this._ctx = _.clone(config.ctx);
        this._browserAgent = browserAgent;
        this._testSkipper = testSkipper;
    }

    buildAdapters(paths, opts) {
        const titles = {};

        paths = (opts || {}).singleInstance ? [paths] : paths; // FIXME: testsPerSession feature

        return paths.map((path) => this._createMocha(path, titles));
    }

    _createMocha(paths, titles) {
        const mocha = MochaAdapter.create(this._sharedMochaOpts, this._browserAgent, this._ctx);

        qUtils.passthroughEvent(mocha, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ
        ]);

        return mocha
            .attachTitleValidator(titles)
            .applySkip(this._testSkipper)
            .loadFiles([].concat(paths));
    }
};
