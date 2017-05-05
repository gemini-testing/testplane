'use strict';

const EventEmitter = require('events').EventEmitter;
const _ = require('lodash');
const qUtils = require('qemitter/utils');
const RunnerEvents = require('../../../constants/runner-events');
const MochaAdapter = require('../mocha-adapter');
const TestFileCollection = require('./test-file-collection');

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
        const testFileCollection = TestFileCollection.create(filenames);
        const mochas = [this._createMocha(testFileCollection, limit)];

        return this._buildAdapters(testFileCollection, limit, mochas);
    }

    _buildAdapters(testFileCollection, limit, mochas) {
        if (testFileCollection.isEmpty()) {
            return mochas;
        }

        const filename = testFileCollection.getCurrentFile();
        const mocha = _.last(mochas).testsCountToRun === limit
            ? this._createMocha(testFileCollection, limit)
            : mochas.pop();

        mocha.loadFile(filename).hasTests() && mochas.push(mocha);
        mocha.testsCountToRun !== limit && testFileCollection.nextFile();

        return this._buildAdapters(testFileCollection, limit, mochas);
    }

    _createMocha(testFileCollection, limit) {
        const mocha = MochaAdapter.create(this._sharedMochaOpts, this._browserAgent, this._ctx);

        qUtils.passthroughEvent(mocha, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ
        ]);

        return mocha
            .applySkip(this._testSkipper)
            .attachTestFilter((test, index) => {
                if (shouldBeRun(test, index)) {
                    testFileCollection.registerTest(test);
                    return true;
                }

                return false;
            });

        function shouldBeRun(test, index) {
            return mocha.testsCountToRun < limit && index > testFileCollection.lastLoadedTestIndex(test.file);
        }
    }
};
