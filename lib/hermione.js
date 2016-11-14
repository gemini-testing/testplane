'use strict';

const pluginsLoader = require('plugins-loader');
const HermioneFacade = require('./hermione-facade');
const RunnerEvents = require('./constants/runner-events');
const Runner = require('./runner');
const readTests = require('./tests-reader');

const PREFIX = require('../package').name + '-';

// Hack for node@0.10 and lower
// Remove restriction for maximum open concurrent sockets
require('http').globalAgent.maxSockets = Infinity;

process.on('uncaughtException', (err) => console.error(err.stack));

module.exports = class Hermione {
    static create(config, options) {
        return new Hermione(config, options);
    }

    constructor(config, options) {
        this._config = config;
        this._options = options;
        this._failed = false;
    }

    run(testPaths, browsers) {
        const runner = Runner.create(this._config);

        runner.on(RunnerEvents.TEST_FAIL, () => this._fail());
        runner.on(RunnerEvents.SUITE_FAIL, () => this._fail());
        runner.on(RunnerEvents.ERROR, () => this._fail());

        this._options.reporters.forEach((reporter) => applyReporter(runner, reporter));

        this._loadPlugins(runner);

        return readTests(testPaths, browsers, this._config)
            .then((tests) => runner.run(tests))
            .then(() => !this._failed);
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
