'use strict';

const _ = require('lodash');
const eventsUtils = require('gemini-core').events.utils;

const BaseHermione = require('./base-hermione');
const Runner = require('./runner');
const RuntimeConfig = require('./config/runtime-config');
const RunnerEvents = require('./constants/runner-events');
const signalHandler = require('./signal-handler');
const TestReader = require('./test-reader');
const TestCollection = require('./test-collection');
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

    async run(testPaths, {browsers, sets, grep, updateRefs, reporters} = {}) {
        validateUnknownBrowsers(browsers, _.keys(this._config.browsers));

        this._runner = Runner.create(this._config)
            .on(RunnerEvents.TEST_FAIL, () => this._fail())
            .on(RunnerEvents.ERROR, () => this._fail());

        _.forEach(reporters, (reporter) => applyReporter(this._runner, reporter));

        eventsUtils.passthroughEvent(this._runner, this, _.values(RunnerEvents.getSync()));
        eventsUtils.passthroughEventAsync(this._runner, this, _.values(RunnerEvents.getAsync()));
        eventsUtils.passthroughEventAsync(signalHandler, this, RunnerEvents.EXIT);

        RuntimeConfig.getInstance().extend({updateRefs});

        await this._init();

        const testCollection = testPaths instanceof TestCollection
            ? testPaths
            : await this.readTests(testPaths, {browsers, sets, grep});

        await this._runner.run(testCollection);

        return !this.isFailed();
    }

    async readTests(testPaths, {browsers, sets, grep, silent, ignore} = {}) {
        const testReader = TestReader.create(this._config);

        if (!silent) {
            await this._init();

            eventsUtils.passthroughEvent(testReader, this, [
                RunnerEvents.BEFORE_FILE_READ,
                RunnerEvents.AFTER_FILE_READ
            ]);
        }

        const specs = await testReader.read({paths: testPaths, browsers, ignore, sets, grep});

        return TestCollection.create(specs);
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
