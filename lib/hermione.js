'use strict';

const _ = require('lodash');

const RunnerStats = require('./stats');
const BaseHermione = require('./base-hermione');
const Runner = require('./runner');
const RuntimeConfig = require('./config/runtime-config');
const RunnerEvents = require('./constants/runner-events');
const eventsUtils = require('./core/events/utils');
const signalHandler = require('./signal-handler');
const TestReader = require('./test-reader');
const TestCollection = require('./test-collection');
const validateUnknownBrowsers = require('./validators').validateUnknownBrowsers;
const {initReporters} = require('./reporters');
const logger = require('./utils/logger');

module.exports = class Hermione extends BaseHermione {
    constructor(config) {
        super(config);

        this._failed = false;
    }

    extendCli(parser) {
        this.emit(RunnerEvents.CLI, parser);
    }

    async run(testPaths, {browsers, sets, grep, updateRefs, requireModules, inspectMode, reporters = []} = {}) {
        validateUnknownBrowsers(browsers, _.keys(this._config.browsers));

        RuntimeConfig.getInstance().extend({updateRefs, requireModules, inspectMode});

        this._runner = Runner.create(this._config, this._interceptors);

        this
            .on(RunnerEvents.TEST_FAIL, () => this._fail())
            .on(RunnerEvents.ERROR, (err) => this.halt(err));

        await initReporters(reporters, this);

        eventsUtils.passthroughEvent(this._runner, this, _.values(RunnerEvents.getSync()));
        eventsUtils.passthroughEventAsync(this._runner, this, _.values(RunnerEvents.getAsync()));
        eventsUtils.passthroughEventAsync(signalHandler, this, RunnerEvents.EXIT);

        await this._init();
        this._runner.init();
        await this._runner.run(await this._readTests(testPaths, {browsers, sets, grep}), RunnerStats.create(this));

        return !this.isFailed();
    }

    async _readTests(testPaths, opts) {
        return testPaths instanceof TestCollection ? testPaths : await this.readTests(testPaths, opts);
    }

    addTestToRun(test, browserId) {
        return this._runner ? this._runner.addTestToRun(test, browserId) : false;
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
        const collection = TestCollection.create(specs, this._config);

        collection.getBrowsers().forEach((bro) => {
            if (this._config.forBrowser(bro).strictTestsOrder) {
                collection.sortTests(bro, ({id: a}, {id: b}) => a < b ? -1 : 1);
            }
        });

        if (!silent) {
            this.emit(RunnerEvents.AFTER_TESTS_READ, collection);
        }

        return collection;
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
