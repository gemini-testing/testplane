"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _TestParser_instances, _TestParser_opts, _TestParser_failedTests, _TestParser_buildInstructions, _TestParser_applyInstructionsEvents, _TestParser_passthroughFileEvents, _TestParser_clearRequireCache, _TestParser_validateUniqTitles;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestParser = void 0;
const events_1 = require("events");
const build_instructions_1 = require("./build-instructions");
const skip_controller_1 = require("./controllers/skip-controller");
const only_controller_1 = require("./controllers/only-controller");
const also_controller_1 = require("./controllers/also-controller");
const config_controller_1 = require("./controllers/config-controller");
const browser_version_controller_1 = require("./controllers/browser-version-controller");
const tree_builder_1 = require("./tree-builder");
const mocha_reader_1 = require("./mocha-reader");
const events_2 = require("../events");
const test_parser_api_1 = require("./test-parser-api");
const test_transformer_1 = require("../bundle/test-transformer");
const events_3 = require("../events");
const lodash_1 = __importDefault(require("lodash"));
const clear_require_1 = __importDefault(require("clear-require"));
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const logger_1 = __importDefault(require("../utils/logger"));
const crypto_1 = require("../utils/crypto");
const getFailedTestId = (test) => (0, crypto_1.getShortMD5)(`${test.fullTitle}${test.browserId}${test.browserVersion}`);
class TestParser extends events_1.EventEmitter {
    constructor(opts = {}) {
        super();
        _TestParser_instances.add(this);
        _TestParser_opts.set(this, void 0);
        _TestParser_failedTests.set(this, void 0);
        _TestParser_buildInstructions.set(this, void 0);
        __classPrivateFieldSet(this, _TestParser_opts, opts, "f");
        __classPrivateFieldSet(this, _TestParser_failedTests, new Set(), "f");
        __classPrivateFieldSet(this, _TestParser_buildInstructions, new build_instructions_1.InstructionsList(), "f");
    }
    async loadFiles(files, { config, runnableOpts }) {
        const eventBus = new events_1.EventEmitter();
        const { system: { ctx, mochaOpts }, } = config;
        const toolGlobals = {
            browser: (0, browser_version_controller_1.mkProvider)(config.getBrowserIds(), eventBus),
            config: config_controller_1.ConfigController.create(eventBus),
            ctx: lodash_1.default.clone(ctx),
            only: only_controller_1.OnlyController.create(eventBus),
            skip: skip_controller_1.SkipController.create(eventBus),
            also: also_controller_1.AlsoController.create(eventBus),
        };
        global.testplane = toolGlobals;
        global.hermione = toolGlobals;
        __classPrivateFieldGet(this, _TestParser_buildInstructions, "f")
            .push(build_instructions_1.Instructions.extendWithBrowserId)
            .push(build_instructions_1.Instructions.extendWithBrowserVersion)
            .push(build_instructions_1.Instructions.extendWithTimeout)
            .push(build_instructions_1.Instructions.disableInPassiveBrowser)
            .push(build_instructions_1.Instructions.buildGlobalSkipInstruction(config));
        __classPrivateFieldGet(this, _TestParser_instances, "m", _TestParser_applyInstructionsEvents).call(this, eventBus);
        __classPrivateFieldGet(this, _TestParser_instances, "m", _TestParser_passthroughFileEvents).call(this, eventBus, toolGlobals);
        __classPrivateFieldGet(this, _TestParser_instances, "m", _TestParser_clearRequireCache).call(this, files);
        const revertTransformHook = (0, test_transformer_1.setupTransformHook)({ removeNonJsImports: __classPrivateFieldGet(this, _TestParser_opts, "f").testRunEnv === "browser" });
        const rand = Math.random();
        const esmDecorator = (f) => f + `?rand=${rand}`;
        await (0, mocha_reader_1.readFiles)(files, { esmDecorator, config: mochaOpts, eventBus, runnableOpts });
        if (config.lastFailed.only) {
            try {
                __classPrivateFieldSet(this, _TestParser_failedTests, new Set(), "f");
                const inputPaths = lodash_1.default.isArray(config.lastFailed.input)
                    ? config.lastFailed.input
                    : config.lastFailed.input.split(",").map(v => v.trim());
                for (const inputPath of inputPaths) {
                    for (const test of await fs_extra_1.default.readJSON(inputPath)) {
                        __classPrivateFieldGet(this, _TestParser_failedTests, "f").add(getFailedTestId(test));
                    }
                }
            }
            catch {
                logger_1.default.warn(`Could not read failed tests data at ${config.lastFailed.input}. Running all tests instead`);
            }
        }
        revertTransformHook();
    }
    parse(files, { browserId, config, grep }) {
        const treeBuilder = new tree_builder_1.TreeBuilder();
        __classPrivateFieldGet(this, _TestParser_buildInstructions, "f").exec(files, { treeBuilder, browserId, config });
        if (grep) {
            treeBuilder.addTestFilter((test) => grep.test(test.fullTitle()));
        }
        if (config.lastFailed && config.lastFailed.only && __classPrivateFieldGet(this, _TestParser_failedTests, "f").size) {
            treeBuilder.addTestFilter(test => {
                return __classPrivateFieldGet(this, _TestParser_failedTests, "f").has(getFailedTestId({
                    fullTitle: test.fullTitle(),
                    browserId: test.browserId,
                    browserVersion: test.browserVersion,
                }));
            });
        }
        const rootSuite = treeBuilder.applyFilters().getRootSuite();
        const tests = rootSuite.getTests();
        __classPrivateFieldGet(this, _TestParser_instances, "m", _TestParser_validateUniqTitles).call(this, tests);
        return tests;
    }
}
exports.TestParser = TestParser;
_TestParser_opts = new WeakMap(), _TestParser_failedTests = new WeakMap(), _TestParser_buildInstructions = new WeakMap(), _TestParser_instances = new WeakSet(), _TestParser_applyInstructionsEvents = function _TestParser_applyInstructionsEvents(eventBus) {
    let currentFile;
    eventBus
        .on(events_3.MasterEvents.BEFORE_FILE_READ, ({ file }) => (currentFile = file))
        .on(events_3.MasterEvents.AFTER_FILE_READ, () => (currentFile = undefined))
        .on(events_2.TestReaderEvents.NEW_BUILD_INSTRUCTION, instruction => __classPrivateFieldGet(this, _TestParser_buildInstructions, "f").push(instruction, currentFile));
}, _TestParser_passthroughFileEvents = function _TestParser_passthroughFileEvents(eventBus, testplane) {
    const passthroughEvent_ = (event, customOpts = {}) => {
        eventBus.on(event, data => this.emit(event, {
            ...data,
            testplane,
            hermione: testplane,
            ...customOpts,
        }));
    };
    passthroughEvent_(events_3.MasterEvents.BEFORE_FILE_READ, { testParser: test_parser_api_1.TestParserAPI.create(testplane, eventBus) });
    passthroughEvent_(events_3.MasterEvents.AFTER_FILE_READ);
}, _TestParser_clearRequireCache = function _TestParser_clearRequireCache(files) {
    files.forEach(filename => {
        if (path_1.default.extname(filename) !== ".mjs") {
            (0, clear_require_1.default)(path_1.default.resolve(filename));
        }
    });
}, _TestParser_validateUniqTitles = function _TestParser_validateUniqTitles(tests) {
    const titles = {};
    tests.forEach(test => {
        const fullTitle = test.fullTitle();
        const relatePath = path_1.default.relative(process.cwd(), test.file);
        if (!titles[fullTitle]) {
            titles[fullTitle] = relatePath;
            return;
        }
        if (titles[fullTitle] === relatePath) {
            throw new Error(`Tests with the same title '${fullTitle}'` + ` in file '${titles[fullTitle]}' can't be used`);
        }
        else {
            throw new Error(`Tests with the same title '${fullTitle}'` +
                ` in files '${titles[fullTitle]}' and '${relatePath}' can't be used`);
        }
    });
};
//# sourceMappingURL=test-parser.js.map