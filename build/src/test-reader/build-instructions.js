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
var _InstructionsList_commonInstructions, _InstructionsList_fileInstructions;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Instructions = exports.InstructionsList = void 0;
const lodash_1 = __importDefault(require("lodash"));
const validators_1 = require("../validators");
const env_1 = __importDefault(require("../utils/env"));
const runtime_config_1 = __importDefault(require("../config/runtime-config"));
class InstructionsList {
    constructor() {
        _InstructionsList_commonInstructions.set(this, void 0);
        _InstructionsList_fileInstructions.set(this, void 0);
        __classPrivateFieldSet(this, _InstructionsList_commonInstructions, [], "f");
        __classPrivateFieldSet(this, _InstructionsList_fileInstructions, new Map(), "f");
    }
    push(fn, file) {
        const instructions = file ? __classPrivateFieldGet(this, _InstructionsList_fileInstructions, "f").get(file) || [] : __classPrivateFieldGet(this, _InstructionsList_commonInstructions, "f");
        instructions.push(fn);
        if (file && !__classPrivateFieldGet(this, _InstructionsList_fileInstructions, "f").has(file)) {
            __classPrivateFieldGet(this, _InstructionsList_fileInstructions, "f").set(file, instructions);
        }
        return this;
    }
    exec(files, ctx) {
        __classPrivateFieldGet(this, _InstructionsList_commonInstructions, "f").forEach(fn => fn(ctx));
        files.forEach(file => {
            const instructions = __classPrivateFieldGet(this, _InstructionsList_fileInstructions, "f").get(file) || [];
            instructions.forEach(fn => fn(ctx));
        });
    }
}
exports.InstructionsList = InstructionsList;
_InstructionsList_commonInstructions = new WeakMap(), _InstructionsList_fileInstructions = new WeakMap();
function extendWithBrowserId({ treeBuilder, browserId }) {
    treeBuilder.addTrap(testObject => {
        testObject.browserId = browserId;
    });
}
function extendWithBrowserVersion({ treeBuilder, config }) {
    const { desiredCapabilities: { browserVersion, version }, } = config;
    treeBuilder.addTrap(testObject => {
        testObject.browserVersion = browserVersion || version;
    });
}
function extendWithTimeout({ treeBuilder, config }) {
    const { testTimeout } = config;
    const { replMode } = runtime_config_1.default.getInstance();
    if (!lodash_1.default.isNumber(testTimeout) || replMode?.enabled) {
        return;
    }
    treeBuilder.addTrap(testObject => {
        testObject.timeout = testTimeout;
    });
}
function disableInPassiveBrowser({ treeBuilder, config }) {
    const { passive } = config;
    if (!passive) {
        return;
    }
    treeBuilder.addTrap(testObject => {
        testObject.disable();
    });
}
function buildGlobalSkipInstruction(config) {
    const { value: skipBrowsers, key: envKey } = env_1.default.parseCommaSeparatedValue([
        "TESTPLANE_SKIP_BROWSERS",
        "HERMIONE_SKIP_BROWSERS",
    ]);
    (0, validators_1.validateUnknownBrowsers)(skipBrowsers, config.getBrowserIds());
    return ({ treeBuilder, browserId }) => {
        if (!skipBrowsers.includes(browserId)) {
            return;
        }
        treeBuilder.addTrap(testObject => {
            testObject.skip({ reason: `The test was skipped by environment variable ${envKey}` });
        });
    };
}
exports.Instructions = {
    extendWithBrowserId,
    extendWithBrowserVersion,
    extendWithTimeout,
    disableInPassiveBrowser,
    buildGlobalSkipInstruction,
};
//# sourceMappingURL=build-instructions.js.map