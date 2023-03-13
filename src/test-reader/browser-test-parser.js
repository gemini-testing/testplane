const {EventEmitter} = require('events');
const {InstructionsList} = require('./build-instructions');
const {SkipController} = require('./controllers/skip-controller');
const {OnlyController} = require('./controllers/only-controller');
const {ConfigController} = require('./controllers/config-controller');
const browserVersionController = require('./controllers/browser-version-controller');
const {readFiles} = require('./mocha-reader');
const ReadEvents = require('./read-events');
const TestParserAPI = require('./test-parser-api');
const RunnerEvents = require('../constants/runner-events');
const _ = require('lodash');
const clearRequire = require('clear-require');
const path = require('path');

class BrowserTestParser extends EventEmitter {
    #buildInstructions;

    static create(...args) {
        return new this(...args);
    }

    constructor() {
        super();

        this.#buildInstructions = new InstructionsList();
    }

    addRootSuiteDecorator(fn) {
        this.#buildInstructions.unshift(({treeBuilder}) => {
            treeBuilder.addTrap(fn);
        });
    }

    applyGrep(re) {
        this.#buildInstructions.push(({treeBuilder}) => {
            treeBuilder.addTestFilter((test) => re.test(test.fullTitle()));
        });
    }

    async loadFiles(files, config, browserId) {
        const eventBus = new EventEmitter();
        const {system: {ctx, mochaOpts}} = config;

        global.hermione = {
            browser: browserVersionController.mkProvider(config.getBrowserIds(), eventBus),
            config: ConfigController.create(eventBus),
            ctx: _.clone(ctx),
            only: OnlyController.create(eventBus),
            skip: SkipController.create(eventBus)
        };

        this.#decorateRootSuiteWithBrowserData();
        this.#decorateRootSuiteWithTimeout();

        this.#applyInstructionsEvents(eventBus);
        this.#passthroughFileEvents(eventBus, global.hermione);

        this.#clearRequireCach(files);

        const esmDecorator = (f) => f + `?browserId=${browserId}`;
        await readFiles(files, {esmDecorator, config: mochaOpts, eventBus});

        return this;
    }

    #decorateRootSuiteWithBrowserData() {
        this.#buildInstructions.push(({treeBuilder, browserId, config}) => {
            const {desiredCapabilities: {browserVersion, version}} = config;

            treeBuilder.addTrap((suite) => {
                suite.browserId = browserId;
                suite.browserVersion = browserVersion || version;
            });
        });
    }

    #decorateRootSuiteWithTimeout() {
        this.#buildInstructions.push(({treeBuilder, config}) => {
            const {testTimeout} = config;
            if (!_.isNumber(testTimeout)) {
                return;
            }

            treeBuilder.addTrap((suite) => {
                suite.timeout = testTimeout;
            });
        });
    }

    #applyInstructionsEvents(eventBus) {
        eventBus.on(ReadEvents.NEW_BUILD_INSTRUCTION, (instruction) => {
            this.#buildInstructions.push(instruction);
        });
    }

    #passthroughFileEvents(eventBus, hermione) {
        const passthroughEvent_ = (event, customOpts = {}) => {
            eventBus.on(event, (data) => this.emit(event, {
                ...data,
                hermione,
                ...customOpts
            }));
        };

        passthroughEvent_(RunnerEvents.BEFORE_FILE_READ, {testParser: TestParserAPI.create(hermione, eventBus)});
        passthroughEvent_(RunnerEvents.AFTER_FILE_READ);
    }

    #clearRequireCach(files) {
        files.forEach((filename) => {
            if (path.extname(filename) !== '.mjs') {
                clearRequire(path.resolve(filename));
            }
        });
    }

    parse(browserId, config) {
        const ctx = {browserId, config};
        const rootSuite = this.#buildInstructions.exec(ctx);

        const tests = rootSuite.getTests();

        this.#validateUniqTitles(tests);

        return tests;
    }

    #validateUniqTitles(tests) {
        const titles = {};

        tests.forEach((test) => {
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
}

module.exports = {
    BrowserTestParser
};
