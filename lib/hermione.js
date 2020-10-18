'use strict';
const path = require('path');
const fs = require('fs-extra');

const _ = require('lodash');
const eventsUtils = require('gemini-core').events.utils;

const RunnerStats = require('./stats');
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

    async run(testPaths, {browsers, sets, grep, updateRefs, reporters, inspectMode} = {}) {
        this.shouldReportStaleScreenshots = this._config.reportStaleScreenshots && !grep;
        validateUnknownBrowsers(browsers, _.keys(this._config.browsers));

        RuntimeConfig.getInstance().extend({updateRefs, inspectMode});

        this._runner = Runner.create(this._config, this._interceptors);

        this
            .on(RunnerEvents.TEST_FAIL, () => this._fail())
            .on(RunnerEvents.ERROR, (err) => this.halt(err));

        if (this.shouldReportStaleScreenshots) {
            this.usedRefPaths = new Set();
            const onEnd = () => this._reportStaleScreenshots(updateRefs);
            const onTestEnd = test => {
                if (test.err && test.err.name !== 'AssertViewError') {
                    this.shouldReportStaleScreenshots = false;
                    this.removeListener(RunnerEvents.TEST_END, onTestEnd);
                    this.removeListener(RunnerEvents.END, onEnd);
                } else if (test.hermioneCtx && test.hermioneCtx.usedRefPaths) {
                    test.hermioneCtx.usedRefPaths.forEach(refPath => this.usedRefPaths.add(refPath));
                }
            };
            this.on(RunnerEvents.TEST_END, onTestEnd);
            this.on(RunnerEvents.RUNNER_END, onEnd);
        }

        _.forEach(reporters, (reporter) => applyReporter(this, reporter));

        eventsUtils.passthroughEvent(this._runner, this, _.values(RunnerEvents.getSync()));
        eventsUtils.passthroughEventAsync(this._runner, this, _.values(RunnerEvents.getAsync()));
        eventsUtils.passthroughEventAsync(signalHandler, this, RunnerEvents.EXIT);

        await this._init();
        this._runner.init();
        await this._runner.run(await this._readTests(testPaths, {browsers, sets, grep}), RunnerStats.create(this));

        return !this.isFailed();
    }

    async _reportStaleScreenshots(updateRefs) {
        if (!this.shouldReportStaleScreenshots) {
            return;
        }

        const {screenshotsRoot, screenshotsDir} = this._config;
        const root = screenshotsRoot || (typeof screenshotsDir === 'string' ? screenshotsDir : null);

        if (!root) {
            logger.warn('Please either specify screenshotsRoot or make screenshotDir a string');
            return;
        }

        const usedRefPaths = Array.from(this.usedRefPaths);

        const checkFileOrDir = async fileOrDir => {
            if (!usedRefPaths.some(refPath => refPath.startsWith(fileOrDir))) {
                if (updateRefs) {
                    return fs.remove(fileOrDir);
                } else {
                    logger.error(`No tests using screenshots from ${fileOrDir} are found. Run hermione with --update-refs option to remove it.`);
                    return;
                }
            }

            const stat = await fs.lstat(fileOrDir);
            if (stat.isDirectory()) {
                const children = await fs.readdir(fileOrDir);
                return Promise.all(children.map(child => checkFileOrDir(path.join(fileOrDir, child))));
            }
        };
        return checkFileOrDir(path.resolve(process.cwd(), root));
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
