'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const AsyncEmitter = require('gemini-core').events.AsyncEmitter;
const pluginsLoader = require('plugins-loader');

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
        this._loadPlugins();
    }

    _init() {
        this._init = () => Promise.resolve(); // init only once
        return this.emitAndWait(RunnerEvents.INIT);
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
        pluginsLoader.load(this, this.config.plugins, PREFIX);
    }
};
