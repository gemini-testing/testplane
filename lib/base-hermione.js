'use strict';

const _ = require('lodash');
const AsyncEmitter = require('gemini-core').events.AsyncEmitter;
const pluginsLoader = require('plugins-loader');
const q = require('q');

const Config = require('./config');
const RunnerEvents = require('./constants/runner-events');
const WorkerRunnerEvents = require('./worker/constants/runner-events');

const PREFIX = require('../package').name + '-';

module.exports = class BaseHermione extends AsyncEmitter {
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

    isWorker() {
        throw new Error('Method must be implemented in child classes');
    }

    _loadPlugins() {
        return q.all(pluginsLoader.load(this, this.config.plugins, PREFIX));
    }
};
