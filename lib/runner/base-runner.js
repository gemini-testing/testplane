'use strict';

const _ = require('lodash');
const QEmitter = require('qemitter');
const qUtils = require('qemitter/utils');
const sets = require('../sets');
const TestSkipper = require('./test-skipper');

module.exports = class BaseRunner extends QEmitter {
    static create(config) {
        return new this(config);
    }

    constructor(config, modules) {
        super();

        this._config = config;
        this._modules = modules;

        this._browserPool = this._modules.BrowserPool.create(this._config, this);
        this._testSkipper = TestSkipper.create(this._config);
    }

    _mapRevealedSets(options, cb) {
        return sets.reveal(this._config.sets, options)
            .then((testFiles) => {
                return _.mapValues(testFiles, (files, browserId) => cb(files, browserId));
            });
    }

    _initMochaRunners(options, eventsToPassthrough) {
        return this._mapRevealedSets(options, (files, browserId) => {
            return this._initMochaRunner(files, browserId, eventsToPassthrough);
        });
    }

    _initMochaRunner(files, browserId, eventsToPassthrough) {
        const mochaRunner = this._createMochaRunner(browserId);

        qUtils.passthroughEvent(mochaRunner, this, eventsToPassthrough);

        return mochaRunner.init(files);
    }

    _createMochaRunner(browserId) {
        return this._modules.MochaRunner.create(browserId, this._config, this._browserPool, this._testSkipper);
    }
};
