'use strict';

const MochaAdapter = require('./mocha-adapter');
const utils = require('q-promise-utils');
const QEmitter = require('qemitter');
const _ = require('lodash');

module.exports = class MochaRunner extends QEmitter {
    static create(config, browserAgent, testSkipper) {
        return new MochaRunner(config, browserAgent, testSkipper);
    }

    constructor(config, browserAgent, testSkipper) {
        super();

        this._sharedMochaOpts = config.system.mochaOpts;
        this._browserAgent = browserAgent;
        this._testSkipper = testSkipper;
    }

    run(suitePaths, filterFn) {
        const titles = {};

        return _(suitePaths)
            .map((path) => this._createMocha(path, filterFn, titles))
            .map((mocha) => mocha.run())
            .thru(utils.waitForResults)
            .value();
    }

    _createMocha(suiteFile, filterFn, titles) {
        const mochaAdapter = MochaAdapter.create(this._sharedMochaOpts, this._browserAgent);

        return mochaAdapter
            .attachTestFilter(filterFn)
            .attachTitleValidator(titles, suiteFile)
            .applySkip(this._testSkipper)
            .addFile(suiteFile)
            .attachEmitFn(this.emit.bind(this));
    }
};
