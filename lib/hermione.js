'use strict';

const _ = require('lodash');
const pluginsLoader = require('plugins-loader');
const HermioneFacade = require('./hermione-facade');
const RunnerEvents = require('./constants/runner-events');
const Runner = require('./runner');
const Config = require('./config');
const readTests = require('./tests-reader');

const PREFIX = require('../package').name + '-';

module.exports = class Hermione {
    static create(configPath, allowOverrides) {
        return new Hermione(configPath, allowOverrides);
    }

    constructor(configPath, allowOverrides) {
        this._config = Config.create(configPath, allowOverrides);

        this._failed = false;
    }

    get config() {
        return this._config;
    }

    run(testPaths, options) {
        options = options || {};

        const runner = Runner.create(this._config);

        runner.on(RunnerEvents.TEST_FAIL, () => this._fail());
        runner.on(RunnerEvents.SUITE_FAIL, () => this._fail());
        runner.on(RunnerEvents.ERROR, () => this._fail());

        _.forEach(options.reporters, (reporter) => applyReporter(runner, reporter));

        this._loadPlugins(runner);

        _.extend(this._config.system.mochaOpts, {grep: options.grep});

        return readTests(testPaths, options.browsers, this._config)
            .then((tests) => runner.run(tests))
            .then(() => !this._failed);
    }

    readTests(testPaths, browsers) {
        const runner = Runner.create(this._config);

        return readTests(testPaths, browsers, this._config)
            .then((tests) => runner.buildSuiteTree(tests));
    }

    _loadPlugins(runner) {
        const hermioneFacade = HermioneFacade.create(runner, this._config);

        pluginsLoader.load(hermioneFacade, hermioneFacade.config.plugins, PREFIX);
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
