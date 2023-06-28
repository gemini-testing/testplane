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
var _TestParser_instances, _TestParser_buildInstructions, _TestParser_applyInstructionsEvents, _TestParser_passthroughFileEvents, _TestParser_clearRequireCach, _TestParser_validateUniqTitles;
const { EventEmitter } = require("events");
const { InstructionsList, Instructions } = require("./build-instructions");
const { SkipController } = require("./controllers/skip-controller");
const { OnlyController } = require("./controllers/only-controller");
const { ConfigController } = require("./controllers/config-controller");
const browserVersionController = require("./controllers/browser-version-controller");
const { TreeBuilder } = require("./tree-builder");
const { readFiles } = require("./mocha-reader");
const { TestReaderEvents } = require("../events");
const { TestParserAPI } = require("./test-parser-api");
const { MasterEvents } = require("../events");
const _ = require("lodash");
const clearRequire = require("clear-require");
const path = require("path");
class TestParser extends EventEmitter {
    constructor() {
        super();
        _TestParser_instances.add(this);
        _TestParser_buildInstructions.set(this, void 0);
        __classPrivateFieldSet(this, _TestParser_buildInstructions, new InstructionsList(), "f");
    }
    async loadFiles(files, config) {
        const eventBus = new EventEmitter();
        const { system: { ctx, mochaOpts }, } = config;
        global.hermione = {
            browser: browserVersionController.mkProvider(config.getBrowserIds(), eventBus),
            config: ConfigController.create(eventBus),
            ctx: _.clone(ctx),
            only: OnlyController.create(eventBus),
            skip: SkipController.create(eventBus),
        };
        __classPrivateFieldGet(this, _TestParser_buildInstructions, "f")
            .push(Instructions.extendWithBrowserId)
            .push(Instructions.extendWithBrowserVersion)
            .push(Instructions.extendWithTimeout)
            .push(Instructions.buildGlobalSkipInstruction(config));
        __classPrivateFieldGet(this, _TestParser_instances, "m", _TestParser_applyInstructionsEvents).call(this, eventBus);
        __classPrivateFieldGet(this, _TestParser_instances, "m", _TestParser_passthroughFileEvents).call(this, eventBus, global.hermione);
        __classPrivateFieldGet(this, _TestParser_instances, "m", _TestParser_clearRequireCach).call(this, files);
        const rand = Math.random();
        const esmDecorator = f => f + `?rand=${rand}`;
        await readFiles(files, { esmDecorator, config: mochaOpts, eventBus });
    }
    parse(files, { browserId, config, grep }) {
        const treeBuilder = new TreeBuilder();
        __classPrivateFieldGet(this, _TestParser_buildInstructions, "f").exec(files, { treeBuilder, browserId, config });
        if (grep) {
            treeBuilder.addTestFilter(test => grep.test(test.fullTitle()));
        }
        const rootSuite = treeBuilder.applyFilters().getRootSuite();
        const tests = rootSuite.getTests();
        __classPrivateFieldGet(this, _TestParser_instances, "m", _TestParser_validateUniqTitles).call(this, tests);
        return tests;
    }
}
_TestParser_buildInstructions = new WeakMap(), _TestParser_instances = new WeakSet(), _TestParser_applyInstructionsEvents = function _TestParser_applyInstructionsEvents(eventBus) {
    let currentFile;
    eventBus
        .on(MasterEvents.BEFORE_FILE_READ, ({ file }) => (currentFile = file))
        .on(MasterEvents.AFTER_FILE_READ, () => (currentFile = undefined))
        .on(TestReaderEvents.NEW_BUILD_INSTRUCTION, instruction => __classPrivateFieldGet(this, _TestParser_buildInstructions, "f").push(instruction, currentFile));
}, _TestParser_passthroughFileEvents = function _TestParser_passthroughFileEvents(eventBus, hermione) {
    const passthroughEvent_ = (event, customOpts = {}) => {
        eventBus.on(event, data => this.emit(event, {
            ...data,
            hermione,
            ...customOpts,
        }));
    };
    passthroughEvent_(MasterEvents.BEFORE_FILE_READ, { testParser: TestParserAPI.create(hermione, eventBus) });
    passthroughEvent_(MasterEvents.AFTER_FILE_READ);
}, _TestParser_clearRequireCach = function _TestParser_clearRequireCach(files) {
    files.forEach(filename => {
        if (path.extname(filename) !== ".mjs") {
            clearRequire(path.resolve(filename));
        }
    });
}, _TestParser_validateUniqTitles = function _TestParser_validateUniqTitles(tests) {
    const titles = {};
    tests.forEach(test => {
        const fullTitle = test.fullTitle();
        const relatePath = path.relative(process.cwd(), test.file);
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
module.exports = {
    TestParser,
};
//# sourceMappingURL=test-parser.js.map