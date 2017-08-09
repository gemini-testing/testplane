'use strict';

const _ = require('lodash');
const qUtils = require('qemitter/utils');

const RunnerEvents = require('../constants/runner-events').subprocess();
const Runner = require('./runner');
const BaseHermione = require('../base-hermione');

module.exports = class Hermione extends BaseHermione {
    init(options) {
        this._loadPlugins();

        this._runner = Runner.create(this._config);

        qUtils.passthroughEvent(this._runner, this, _.values(RunnerEvents));

        return this._runner.init(options)
            .then(() => this);
    }

    runTest(fullTitle, options) {
        return this._runner.runTest(fullTitle, options);
    }
};
