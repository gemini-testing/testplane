import { EventEmitter } from 'events';
import path from 'path';
import clearRequire from 'clear-require';
import escapeRe from 'escape-string-regexp';
import _ from 'lodash';
import Mocha from '@gemini-testing/mocha';

import RunnerEvents from '../constants/runner-events';
import ParserEvents from './parser-events';
import TestParserAPI from './test-parser-api';
import Skip from './skip';
import SkipBuilder from './skip/skip-builder';
import OnlyBuilder from './skip/only-builder';
import BrowserConfigurator from './browser';
import * as configController from './config-controller';
import { getShortMD5 } from '../utils/crypto';
import * as logger from '../utils/logger';

import type { BrowserAPI } from './browser';
import type TestSkipper from './test-skipper';
import type Config from '../config';
import type BrowserConfig from '../config/browser-config';
import type { Test, Suite, Hook } from '../types/mocha';

type HermioneCli = {
    ctx: any;
    skip: SkipBuilder;
    only: OnlyBuilder;
    browser: (requiredBrowserId: string) => BrowserAPI;
}; //TODO

declare global {
    namespace NodeJS {
        interface Global {
            hermione: HermioneCli
        }
    }
}

interface MochaTestParserEvents {
    [ParserEvents.TEST]: (test: Test) => void;
    [ParserEvents.SUITE]: (suite: Suite) => void;
    [ParserEvents.HOOK]: (hook: Hook) => void;
    [RunnerEvents.BEFORE_FILE_READ]: (opts: {
        browser: string,
        hermione: HermioneCli,
        file: string,
        testParser: TestParserAPI
    }) => void;
    [RunnerEvents.AFTER_FILE_READ]: (opts: {
        browser: string,
        hermione: HermioneCli,
        file: string
    }) => void;
}  

declare interface MochaTestParser {
    on<U extends keyof MochaTestParserEvents>(event: U, listener: MochaTestParserEvents[U]): this;
    emit<U extends keyof MochaTestParserEvents>(event: U, ...args: Parameters<MochaTestParserEvents[U]>): boolean;
}

class MochaTestParser extends EventEmitter {
    private _browserId: string;
    private _browserConfig: BrowserConfig;
    private _config: Config;
    private _parserAPI: TestParserAPI;
    private _mocha: Mocha;
    public suite: Suite;
    public tests: Array<Test>;

    public static prepare(): void {
        global.hermione = global.hermione || {};
    }

    public static create(browserId: string, config: Config): MochaTestParser {
        return new MochaTestParser(browserId, config);
    }

    constructor(browserId: string, config: Config) {
        super();

        this._browserId = browserId;
        this._browserConfig = config.forBrowser(browserId);
        this._config = config;

        this._mocha = new Mocha(this._browserConfig.system.mochaOpts as Mocha.MochaOptions);
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

        this._parserAPI = TestParserAPI.create(this, global.hermione);
    }

    private _setTimeout(): void {
        const {testTimeout} = this._browserConfig;

        if (_.isNumber(testTimeout)) {
            this._mocha.timeout(testTimeout);
        }
    }

    private _passthroughParserEvents(): void {
        this._addEventHandler('suite', (suite) => this.emit(ParserEvents.SUITE, suite));
        this._addEventHandler('test', (test) => this.emit(ParserEvents.TEST, test));
        this._addEventHandler(['beforeEach', 'afterEach'], (hook) => this.emit(ParserEvents.HOOK, hook));
    }

    private _forbidSuiteHooks(): void {
        this._addEventHandler(['beforeAll', 'afterAll'], () => {
            throw new Error('"before" and "after" hooks are forbidden, use "beforeEach" and "afterEach" hooks instead');
        });
    }

    private _extendSuiteApi(): void {
        let suiteCounter = 0;
        let filePath: string;

        // mocha does not set file for skipped suites
        // https://github.com/mochajs/mocha/blob/eb8bf8de205f3fdba072e58440e55256e701a7ba/lib/interfaces/bdd.js#L55
        this.suite.on('pre-require', (ctx, file) => {
            filePath = file;
        });

        this.on(ParserEvents.SUITE, (suite) => {
            const id = `${getShortMD5(filePath)}${suiteCounter++}`;
            suite.id = () => id;
            suite.id.toString = () => id;
        });
    }

    private _extendTestApi(): void {
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

    private _extendHookApi(): void {
        this.on(ParserEvents.HOOK, (hook) => hook.browserId = this._browserId);
    }

    private _passthroughFileEvents(): this {
        const emit_ = (
            event: RunnerEvents.BEFORE_FILE_READ | RunnerEvents.AFTER_FILE_READ,
            opts: {file: string, testParser?: TestParserAPI}
        ) => this.emit(event, {
            browser: this._browserId,
            hermione: global.hermione,
            ...opts
        });

        this.suite.on('pre-require', (ctx, file) => {
            emit_(RunnerEvents.BEFORE_FILE_READ, {
                file,
                testParser: this._parserAPI
            });
        });
        this.suite.on('post-require', (ctx, file) => emit_(RunnerEvents.AFTER_FILE_READ, {file}));

        return this;
    }

    public applySkip(testSkipper: TestSkipper): this {
        testSkipper.applySkip(this.suite, this._browserId);

        return this;
    }

    public applyConfigController(): this {
        this.on(RunnerEvents.BEFORE_FILE_READ, ({testParser}) => {
            testParser.setController('config', configController);
        });

        return this;
    }

    public applyGrep(grep?: string): this {
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

    public loadFiles(files: string | Array<string>): this {
        global.hermione.ctx = _.clone(this._browserConfig.system.ctx);

        this._injectSkip(global.hermione);
        this._injectBrowserConfigurator(global.hermione);

        ([] as Array<string>).concat(files).forEach((filename) => {
            clearRequire(path.resolve(filename));
            this._mocha.addFile(filename);
        });

        //@ts-ignore protected method
        this._mocha.loadFiles();
        if (this._mocha.suite.hasOnly()) {
            this._mocha.suite.filterOnly();
        }
        this._mocha.files = [];

        this._validateUniqTitles();

        return this;
    }

    private _injectSkip(hermione: HermioneCli): void {
        const skip = new Skip();

        hermione.skip = new SkipBuilder(skip, this._browserId);
        hermione.only = new OnlyBuilder(hermione.skip);

        this.on(ParserEvents.TEST, (test) => skip.handleEntity(test));
        this.on(ParserEvents.SUITE, (suite) => skip.handleEntity(suite));
    }

    private _injectBrowserConfigurator(hermione: HermioneCli): void {
        const browserIds = this._config.getBrowserIds();
        const configurator = new BrowserConfigurator(this._browserId, browserIds);

        hermione.browser = configurator.exposeAPI();

        this.on(ParserEvents.TEST, (test) => configurator.handleTest(test));
        this.on(ParserEvents.SUITE, () => configurator.handleSuite());
    }

    private _validateUniqTitles(): void {
        const titles: Record<string, string> = {};

        this._mocha.suite.eachTest((test) => {
            const fullTitle = test.fullTitle();
            const relatePath = path.relative(process.cwd(), test.file || '');

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

    public parse(): Array<Test> {
        const tests: Array<Test> = [];
        const {grep} = this._mocha.options;

        this.suite.eachTest((test) => {
            if (!_.isUndefined(grep) && !RegExp(grep).test(test.fullTitle())) {
                Object.assign(test, {pending: true, silentSkip: true});
            }

            tests.push(test as Test);
        });

        return tests;
    }

    // Set recursive handler for events triggered by mocha while parsing test file
    private _addEventHandler(event: Array<string> | string, cb: (...args: Array<any>) => void): void {
        const events = ([] as Array<string>).concat(event);

        const listenSuite = (suite: Suite) => {
            suite.on('suite', listenSuite);
            events.forEach((e) => suite.on(e, cb));
        };

        listenSuite(this.suite);
    }
};

export default MochaTestParser;
