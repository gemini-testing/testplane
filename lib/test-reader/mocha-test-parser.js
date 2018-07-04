'use strict';

const EventEmitter = require('events').EventEmitter;
const path = require('path');
const clearRequire = require('clear-require');
const _ = require('lodash');
const Mocha = require('mocha');
const RunnerEvents = require('../constants/runner-events');
const ParserEvents = require('./parser-events');
const SuiteSubset = require('./suite-subset');
const TestParserAPI = require('./test-parser-api');
const Skip = require('./skip');
const SkipBuilder = require('./skip/skip-builder');
const OnlyBuilder = require('./skip/only-builder');
const {getShortMD5} = require('../utils/crypto');

module.exports = class MochaTestParser extends EventEmitter {
    static prepare() {
        global.hermione = global.hermione || {};
    }

    static create(...args) {
        return new MochaTestParser(...args);
    }

    constructor(browserId, config) {
        super();

        this._mochaOpts = config.mochaOpts || {};
        this._browserId = browserId;

        this._initMocha();

        _.extend(global.hermione, {ctx: _.clone(config.ctx)});

        this._parserAPI = TestParserAPI.create(this, global.hermione);
    }

    _initMocha() {
        this._mocha = new Mocha(this._mochaOpts);
        this._mocha.fullTrace();

        this.suite = this._mocha.suite;
        this.suite.setMaxListeners(0);
        this._addEventHandler('suite', (suite) => suite.setMaxListeners(0));

        this.tests = [];

        this._passthroughParserEvents();
        this._forbidSuiteHooks();
        this._removeTestHooks();
        this._injectSkip();
        this._extendSuiteApi();
        this._extendTestApi();
        this._passthroughFileEvents();
    }

    _passthroughParserEvents() {
        this._addEventHandler('suite', (suite) => this.emit(ParserEvents.SUITE, suite));
        this._addEventHandler('test', (test) => this.emit(ParserEvents.TEST, test));
    }

    _forbidSuiteHooks() {
        this._addEventHandler(['beforeAll', 'afterAll'], () => {
            throw new Error('"before" and "after" hooks are forbidden, use "beforeEach" and "afterEach" hooks instead');
        });
    }

    _removeTestHooks() {
        this._addEventHandler('beforeEach', (hook) => hook.parent._beforeEach.pop());
        this._addEventHandler('afterEach', (hook) => hook.parent._afterEach.pop());
    }

    _injectSkip() {
        const skip = new Skip();
        const skipBuilder = new SkipBuilder(skip, this._browserId);
        const onlyBuilder = new OnlyBuilder(skipBuilder);

        _.extend(global.hermione, {skip: skipBuilder, only: onlyBuilder});

        this._addEventHandler(['suite', 'test'], (runnable) => skip.handleEntity(runnable));
    }

    _extendSuiteApi() {
        let suiteCounter = 0;
        let filePath;

        // mocha does not set file for skipped suites
        // https://github.com/mochajs/mocha/blob/eb8bf8de205f3fdba072e58440e55256e701a7ba/lib/interfaces/bdd.js#L55
        this.suite.on('pre-require', (ctx, file) => {
            filePath = file;
        });

        this.on(ParserEvents.SUITE, (suite) => {
            const suiteIndex = suiteCounter++;
            suite.id = () => `${getShortMD5(filePath)}${suiteIndex}`;
        });
    }

    _extendTestApi() {
        this.on(ParserEvents.TEST, (test) => {
            test.id = () => getShortMD5(test.fullTitle());
        });
    }

    _passthroughFileEvents() {
        let suite;

        const emit_ = (event, opts) => this.emit(event, {
            suite,
            browser: this._browserId,
            hermione: global.hermione,
            ...opts
        });

        this.suite.on('pre-require', (ctx, file) => {
            suite = SuiteSubset.create(this.suite, file);
            emit_(RunnerEvents.BEFORE_FILE_READ, {
                file,
                testParser: this._parserAPI
            });
        });
        this.suite.on('post-require', (ctx, file) => emit_(RunnerEvents.AFTER_FILE_READ, {file}));

        return this;
    }

    applySkip(testSkipper) {
        testSkipper.applySkip(this.suite, this._browserId);

        return this;
    }

    applyGrep(grep) {
        if (grep) {
            this._mocha.grep(grep);
        }

        return this;
    }

    loadFiles(files) {
        [].concat(files).forEach((filename) => {
            clearRequire(path.resolve(filename));
            this._mocha.addFile(filename);
        });

        this._mocha.loadFiles();
        this._mocha.files = [];

        this._validateUniqTitles();

        return this;
    }

    _validateUniqTitles() {
        const titles = {};

        this._mocha.suite.eachTest((test) => {
            const fullTitle = test.fullTitle();
            const relatePath = path.relative(process.cwd(), test.file);

            if (!titles[fullTitle]) {
                titles[fullTitle] = relatePath;
                return;
            }

            if (titles[fullTitle] === relatePath) {
                throw new Error(`Tests with the same title '${fullTitle}'` +
                    ` in file '${titles[fullTitle]}' can't be used`);
            } else {
                throw new Error(`Tests with the same title '${fullTitle}'` +
                    ` in files '${titles[fullTitle]}' and '${relatePath}' can't be used`);
            }
        });
    }

    parse() {
        const tests = [];

        this.suite.eachTest((test) => {
            const {grep} = this._mochaOpts;
            if (grep && !grep.test(test.fullTitle())) {
                Object.assign(test, {pending: true, silentSkip: true});
            }
            tests.push(test);
        });

        return tests;
    }

    // Set recursive handler for events triggered by mocha while parsing test file
    _addEventHandler(events, cb) {
        events = [].concat(events);

        const listenSuite = (suite) => {
            suite.on('suite', listenSuite);
            events.forEach((e) => suite.on(e, cb));
        };

        listenSuite(this.suite);
    }
};
