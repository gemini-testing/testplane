'use strict';

const _ = require('lodash');
const q = require('q');
const eventsUtils = require('gemini-core').events.utils;

const BaseHermione = require('./base-hermione');
const Runner = require('./runner');
const RuntimeConfig = require('./config/runtime-config');
const RunnerEvents = require('./constants/runner-events');
const signalHandler = require('./signal-handler');
const sets = require('./sets');
const validateUnknownBrowsers = require('./validators').validateUnknownBrowsers;
const logger = require('./utils/logger');

module.exports = class Hermione extends BaseHermione {
    constructor(configPath) {
        super(configPath);

        this._failed = false;
    }

    extendCli(parser) {
        this.emit(RunnerEvents.CLI, parser);
    }

    run(testPaths, options) {
        options = options || {};

        validateUnknownBrowsers(options.browsers, _.keys(this._config.browsers));

        this._runner = Runner.create(this._config);
        this._runner.on(RunnerEvents.TEST_FAIL, () => this._fail());
        this._runner.on(RunnerEvents.ERROR, () => this._fail());

        _.forEach(options.reporters, (reporter) => applyReporter(this._runner, reporter));

        eventsUtils.passthroughEvent(this._runner, this, _.values(RunnerEvents.getSync()));
        eventsUtils.passthroughEventAsync(this._runner, this, _.values(RunnerEvents.getAsync()));
        eventsUtils.passthroughEventAsync(signalHandler, this, RunnerEvents.EXIT);

        _.extend(this._config.system.mochaOpts, {grep: options.grep});

        RuntimeConfig.getInstance().extend({updateRefs: options.updateRefs});

        return this._init()
            .then(() => sets.reveal(this._config.sets, {paths: testPaths, browsers: options.browsers, sets: options.sets}))
            .then((testFiles) => this._runner.run(testFiles))
            .then(() => !this.isFailed());
    }

    readTests(testPaths, browsers, options = {}) {
        const runner = Runner.create(this._config);
        const {silent, ignore} = options;

        let init = q();
        if (!silent) {
            eventsUtils.passthroughEvent(runner, this, _.values(RunnerEvents.getSync()));
            init = this._init();
        }

        return init
            .then(() => sets.reveal(this._config.sets, {paths: testPaths, browsers, ignore}))
            .then((testFiles) => runner.buildSuiteTree(testFiles));
    }

    isFailed() {
        return this._failed;
    }

    _fail() {
        this._failed = true;
    }

    isWorker() {
        return false;
    }

    halt(err, timeout = 60000) {
        logger.error(`Terminating on critical error: ${err}`);

        this._fail();
        this._runner.cancel();

        if (timeout === 0) {
            return;
        }

        setTimeout(() => {
            logger.error('Forcing shutdown...');
            process.exit(1);
        }, timeout).unref();
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
