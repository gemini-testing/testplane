const { EventEmitter } = require("events");
const { InstructionsList, Instructions } = require("./build-instructions");
const { SkipController } = require("./controllers/skip-controller");
const { OnlyController } = require("./controllers/only-controller");
const { AlsoController } = require("./controllers/also-controller");
const { ConfigController } = require("./controllers/config-controller");
const browserVersionController = require("./controllers/browser-version-controller");
const { TreeBuilder } = require("./tree-builder");
const { readFiles } = require("./mocha-reader");
const { TestReaderEvents } = require("../events");
const { TestParserAPI } = require("./test-parser-api");
const { setupTransformHook } = require("./test-transformer");
const { MasterEvents } = require("../events");
const _ = require("lodash");
const clearRequire = require("clear-require");
const path = require("path");
const fs = require("fs-extra");
const logger = require("../utils/logger");
const { getShortMD5 } = require("../utils/crypto");

const getFailedTestId = test => getShortMD5(`${test.fullTitle}${test.browserId}${test.browserVersion}`);

class TestParser extends EventEmitter {
    #opts;
    #failedTests;
    #buildInstructions;

    /**
     * @param {object} opts
     * @param {"nodejs" | "browser" | undefined} opts.testRunEnv - environment to parse tests for
     */
    constructor(opts = {}) {
        super();

        this.#opts = opts;
        this.#failedTests = new Set();
        this.#buildInstructions = new InstructionsList();
    }

    async loadFiles(files, config) {
        const eventBus = new EventEmitter();
        const {
            system: { ctx, mochaOpts },
        } = config;

        const toolGlobals = {
            browser: browserVersionController.mkProvider(config.getBrowserIds(), eventBus),
            config: ConfigController.create(eventBus),
            ctx: _.clone(ctx),
            only: OnlyController.create(eventBus),
            skip: SkipController.create(eventBus),
            also: AlsoController.create(eventBus),
        };

        global.testplane = toolGlobals;
        global.hermione = toolGlobals;

        this.#buildInstructions
            .push(Instructions.extendWithBrowserId)
            .push(Instructions.extendWithBrowserVersion)
            .push(Instructions.extendWithTimeout)
            .push(Instructions.disableInPassiveBrowser)
            .push(Instructions.buildGlobalSkipInstruction(config));

        this.#applyInstructionsEvents(eventBus);
        this.#passthroughFileEvents(eventBus, toolGlobals);

        this.#clearRequireCache(files);

        const revertTransformHook = setupTransformHook({ removeNonJsImports: this.#opts.testRunEnv === "browser" });

        const rand = Math.random();
        const esmDecorator = f => f + `?rand=${rand}`;
        await readFiles(files, { esmDecorator, config: mochaOpts, eventBus });

        if (config.lastFailed.only) {
            try {
                this.#failedTests = new Set();
                const inputPaths = _.isArray(config.lastFailed.input)
                    ? config.lastFailed.input
                    : config.lastFailed.input.split(",").map(v => v.trim());
                for (const inputPath of inputPaths) {
                    for (const test of await fs.readJSON(inputPath)) {
                        this.#failedTests.add(getFailedTestId(test));
                    }
                }
            } catch {
                logger.warn(
                    `Could not read failed tests data at ${config.lastFailed.input}. Running all tests instead`,
                );
            }
        }

        revertTransformHook();
    }

    #applyInstructionsEvents(eventBus) {
        let currentFile;

        eventBus
            .on(MasterEvents.BEFORE_FILE_READ, ({ file }) => (currentFile = file))
            .on(MasterEvents.AFTER_FILE_READ, () => (currentFile = undefined))
            .on(TestReaderEvents.NEW_BUILD_INSTRUCTION, instruction =>
                this.#buildInstructions.push(instruction, currentFile),
            );
    }

    #passthroughFileEvents(eventBus, testplane) {
        const passthroughEvent_ = (event, customOpts = {}) => {
            eventBus.on(event, data =>
                this.emit(event, {
                    ...data,
                    testplane,
                    hermione: testplane,
                    ...customOpts,
                }),
            );
        };

        passthroughEvent_(MasterEvents.BEFORE_FILE_READ, { testParser: TestParserAPI.create(testplane, eventBus) });
        passthroughEvent_(MasterEvents.AFTER_FILE_READ);
    }

    #clearRequireCache(files) {
        files.forEach(filename => {
            if (path.extname(filename) !== ".mjs") {
                clearRequire(path.resolve(filename));
            }
        });
    }

    parse(files, { browserId, config, grep }) {
        const treeBuilder = new TreeBuilder();

        this.#buildInstructions.exec(files, { treeBuilder, browserId, config });

        if (grep) {
            treeBuilder.addTestFilter(test => grep.test(test.fullTitle()));
        }

        if (config.lastFailed && config.lastFailed.only && this.#failedTests.size) {
            treeBuilder.addTestFilter(test => {
                return this.#failedTests.has(
                    getFailedTestId({
                        fullTitle: test.fullTitle(),
                        browserId: test.browserId,
                        browserVersion: test.browserVersion,
                    }),
                );
            });
        }

        const rootSuite = treeBuilder.applyFilters().getRootSuite();

        const tests = rootSuite.getTests();

        this.#validateUniqTitles(tests);

        return tests;
    }

    #validateUniqTitles(tests) {
        const titles = {};

        tests.forEach(test => {
            const fullTitle = test.fullTitle();
            const relatePath = path.relative(process.cwd(), test.file);

            if (!titles[fullTitle]) {
                titles[fullTitle] = relatePath;
                return;
            }

            if (titles[fullTitle] === relatePath) {
                throw new Error(
                    `Tests with the same title '${fullTitle}'` + ` in file '${titles[fullTitle]}' can't be used`,
                );
            } else {
                throw new Error(
                    `Tests with the same title '${fullTitle}'` +
                        ` in files '${titles[fullTitle]}' and '${relatePath}' can't be used`,
                );
            }
        });
    }
}

module.exports = {
    TestParser,
};
