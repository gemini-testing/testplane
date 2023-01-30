'use strict';

const EventEmitter = require('events').EventEmitter;
const path = require('path');
const clearRequire = require('clear-require');
const escapeRe = require('escape-string-regexp');
const _ = require('lodash');
const Mocha = require('@gemini-testing/mocha');
const RunnerEvents = require('../constants/runner-events');
const ParserEvents = require('./parser-events');
const TestParserAPI = require('./test-parser-api');
const Skip = require('./skip');
const SkipBuilder = require('./skip/skip-builder');
const OnlyBuilder = require('./skip/only-builder');
const BrowserConfigurator = require('./browser');
const configController = require('./config-controller');
const {getShortMD5} = require('../utils/crypto');
const logger = require('../utils/logger');

const {EVENT_FILE_PRE_REQUIRE, EVENT_FILE_POST_REQUIRE} = Mocha.Suite.constants;

module.exports = class MochaTestParser extends EventEmitter {
    static prepare(config) {
        global.hermione = global.hermione || {};

        if (!global.expect) {
            const {setOptions} = require('expect-webdriverio');
            setOptions(config.system.expectOpts);
        }
    }

    static create(...args) {
        return new MochaTestParser(...args);
    }

    constructor(browserId, config) {
        super();

        this._browserId = browserId;
        this._browserConfig = config.forBrowser(browserId);
        this._config = config;

        this._initMocha();

        this._parserAPI = TestParserAPI.create(this, global.hermione);
    }

    _initMocha() {
        this._mocha = new Mocha(this._browserConfig.system.mochaOpts);
        this._mocha.fullTrace();

        this.suite = this._mocha.suite;
        this.suite.setMaxListeners(0);
        this._addEventHandler('suite', (suite) => suite.setMaxListeners(0));

        this.tests = [];

        this._setTimeout();
        this._passthroughParserEvents();
        this._forbidSuiteHooks();
        this._extendSuiteApi();
        this._extendTestApi();
        this._extendHookApi();
        this._passthroughFileEvents();
    }

    _setTimeout() {
        const {testTimeout} = this._browserConfig;

        if (_.isNumber(testTimeout)) {
            this._mocha.timeout(testTimeout);
        }
    }

    _passthroughParserEvents() {
        this._addEventHandler('suite', (suite) => this.emit(ParserEvents.SUITE, suite));
        this._addEventHandler('test', (test) => this.emit(ParserEvents.TEST, test));
        this._addEventHandler(['beforeEach', 'afterEach'], (hook) => this.emit(ParserEvents.HOOK, hook));
    }

    _forbidSuiteHooks() {
        this._addEventHandler(['beforeAll', 'afterAll'], () => {
            throw new Error('"before" and "after" hooks are forbidden, use "beforeEach" and "afterEach" hooks instead');
        });
    }

    _extendSuiteApi() {
        let suiteCounter = 0;
        let filePath;

        // mocha does not set file for skipped suites
        // https://github.com/mochajs/mocha/blob/eb8bf8de205f3fdba072e58440e55256e701a7ba/lib/interfaces/bdd.js#L55
        this.suite.on(EVENT_FILE_PRE_REQUIRE, (ctx, file) => {
            filePath = file;
        });

        this.on(ParserEvents.SUITE, (suite) => {
            const id = `${getShortMD5(filePath)}${suiteCounter++}`;
            suite.id = () => id;
            suite.id.toString = () => id;
        });
    }

    _extendTestApi() {
        const {desiredCapabilities} = this._browserConfig;
        const defaultBrowserVersion = desiredCapabilities.browserVersion
            ? desiredCapabilities.browserVersion
            : desiredCapabilities.version;

        this.on(ParserEvents.TEST, (test) => {
            const id = getShortMD5(test.fullTitle());
            test.id = () => id;
            test.id.toString = () => id;
            test.browserId = this._browserId;
            test.browserVersion = test.browserVersion || defaultBrowserVersion;
        });
    }

    _extendHookApi() {
        this.on(ParserEvents.HOOK, (hook) => hook.browserId = this._browserId);
    }

    _passthroughFileEvents() {
        const emit_ = (event, opts) => this.emit(event, {
            browser: this._browserId,
            hermione: global.hermione,
            ...opts
        });

        this.suite.on(EVENT_FILE_PRE_REQUIRE, (ctx, file) => {
            emit_(RunnerEvents.BEFORE_FILE_READ, {
                file,
                testParser: this._parserAPI
            });
        });
        this.suite.on(EVENT_FILE_POST_REQUIRE, (ctx, file) => emit_(RunnerEvents.AFTER_FILE_READ, {file}));

        return this;
    }

    applySkip(testSkipper) {
        testSkipper.applySkip(this.suite, this._browserId);

        return this;
    }

    applyConfigController() {
        this.on(RunnerEvents.BEFORE_FILE_READ, ({testParser}) => {
            testParser.setController('config', configController);
        });

        return this;
    }

    applyGrep(grep) {
        if (grep) {
            try {
                this._mocha.grep(new RegExp(`(${grep})|(${escapeRe(grep)})`));
            } catch (error) {
                logger.warn(`Invalid regexp provided to grep, searching by its string representation. ${error}`);
                this._mocha.grep(new RegExp(escapeRe(grep)));
            }
        }

        return this;
    }

    async loadFiles(files) {
        global.hermione.ctx = _.clone(this._browserConfig.system.ctx);

        this._injectSkip(global.hermione);
        this._injectBrowserConfigurator(global.hermione);

        [].concat(files).forEach((filename) => {
            if (path.extname(filename) !== '.mjs') {
                clearRequire(path.resolve(filename));
            }

            this._mocha.addFile(filename);
        });

        const esmDecorator = (p) => p + `?browserId=${this._browserId}`;

        await this._mocha.loadFilesAsync(esmDecorator);
        if (this._mocha.suite.hasOnly()) {
            this._mocha.suite.filterOnly();
        }
        this._mocha.files = [];

        this._validateUniqTitles();

        return this;
    }

    _injectSkip(hermione) {
        const skip = new Skip();

        hermione.skip = new SkipBuilder(skip, this._browserId);
        hermione.only = new OnlyBuilder(hermione.skip);

        this.on(ParserEvents.TEST, (test) => skip.handleEntity(test));
        this.on(ParserEvents.SUITE, (suite) => skip.handleEntity(suite));
    }

    _injectBrowserConfigurator(hermione) {
        const browserIds = this._config.getBrowserIds();
        const configurator = new BrowserConfigurator(this._browserId, browserIds);

        hermione.browser = configurator.exposeAPI();

        this.on(ParserEvents.TEST, (test) => configurator.handleTest(test));
        this.on(ParserEvents.SUITE, (suite) => configurator.handleSuite(suite));
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
        const {grep} = this._mocha.options;

        this.suite.eachTest((test) => {
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
