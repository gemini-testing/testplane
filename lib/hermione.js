'use strict';

const _ = require('lodash');
const QEmitter = require('qemitter');
const qUtils = require('qemitter/utils');
const pluginsLoader = require('plugins-loader');

const RunnerEvents = require('./constants/runner-events');
const signalHandler = require('./signal-handler');
const Runner = require('./runner');
const Config = require('./config');
const sets = require('./sets');
const validateUnknownBrowsers = require('./validators').validateUnknownBrowsers;

const PREFIX = require('../package').name + '-';

module.exports = class Hermione extends QEmitter {
    static create(configPath, allowOverrides) {
        return new Hermione(configPath, allowOverrides);
    }

    constructor(configPath, allowOverrides) {
        super();

        this._config = Config.create(configPath, allowOverrides);

        this._failed = false;
    }

    get config() {
        return this._config;
    }

    get events() {
        return _.clone(RunnerEvents);
    }

    run(testPaths, options) {
        options = _.extend({}, options, {paths: testPaths});

        validateUnknownBrowsers(options.browsers, _.keys(this._config.browsers));

        const runner = Runner.create(this._config);

        runner.on(RunnerEvents.TEST_FAIL, () => this._fail());
        runner.on(RunnerEvents.SUITE_FAIL, () => this._fail());
        runner.on(RunnerEvents.ERROR, () => this._fail());

        _.forEach(options.reporters, (reporter) => applyReporter(runner, reporter));

        qUtils.passthroughEvent(runner, this, _.values(RunnerEvents.getSync()));
        qUtils.passthroughEventAsync(runner, this, _.values(RunnerEvents.getAsync()));
        qUtils.passthroughEventAsync(signalHandler, this, RunnerEvents.EXIT);

        pluginsLoader.load(this, this.config.plugins, PREFIX);
        _.extend(this._config.system.mochaOpts, {grep: options.grep});

        return sets.reveal(this._config.sets, options)
            .then((testFiles) => runner.run(testFiles))
            .then(() => !this._failed);
    }

    readTests(testPaths, browsers) {
        const runner = Runner.create(this._config);

        return sets.reveal(this._config.sets, {paths: testPaths, browsers})
            .then((tests) => runner.buildSuiteTree(tests));
    }

    _fail() {
        this._failed = true;
    }
};

function applyReporter(runner, reporter) {
    if (typeof reporter === 'string') {
        try {
            reporter = require('./reporters/' + reporter);
        } catch (e) {
            if (e.code === 'MODULE_NOT_FOUND') {
                throw new Error('No such reporter: ' + reporter);
            }
            throw e;
        }
    }
    if (typeof reporter !== 'function') {
        throw new TypeError('Reporter must be a string or a function');
    }

    var Reporter = reporter;

    new Reporter().attachRunner(runner);
}
