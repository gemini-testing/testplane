'use strict';

const _ = require('lodash');
const QEmitter = require('qemitter');
const pluginsLoader = require('plugins-loader');

const Config = require('./config');
const RunnerEvents = require('./constants/runner-events');
const WorkerRunnerEvents = require('./worker/constants/runner-events');

const PREFIX = require('../package').name + '-';

module.exports = class BaseHermione extends QEmitter {
    static create(configPath) {
        return new this(configPath);
    }

    constructor(configPath) {
        super();

        this._config = Config.create(configPath);
    }

    get config() {
        return this._config;
    }

    get events() {
        return _.extend({}, RunnerEvents, WorkerRunnerEvents);
    }

    _loadPlugins() {
        pluginsLoader.load(this, this.config.plugins, PREFIX);
    }
};
