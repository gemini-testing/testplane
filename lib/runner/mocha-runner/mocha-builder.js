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

    buildAdapters(filenames, limit) {
        limit = limit || Infinity;
        let lastLoadedTestIndex = -1;

        const createMocha = () => {
            const mocha = this._createMocha();

            return mocha.attachTestFilter((test, index) => {
                if (getTestsCountToRun(mocha) < limit && index > lastLoadedTestIndex) {
                    ++lastLoadedTestIndex;
                    return true;
                }

                return false;
            });
        };

        const mochas = [createMocha()];

        while (filenames.length) {
            const filename = _.first(filenames);
            const mocha = getTestsCountToRun(_.last(mochas)) === limit ? createMocha() : mochas.pop();

            mocha.loadFile(filename).tests.length && mochas.push(mocha);

            if (getTestsCountToRun(mocha) !== limit) {
                filenames.shift();
                lastLoadedTestIndex = -1;
            }
        }

        return mochas;
    }

    _createMocha() {
        const mocha = MochaAdapter.create(this._sharedMochaOpts, this._browserAgent, this._ctx);

        qUtils.passthroughEvent(mocha, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ
        ]);

        return mocha.applySkip(this._testSkipper);
    }
};

function getTestsCountToRun(mocha) {
    return _.filter(mocha.tests, {pending: false}).length;
}
