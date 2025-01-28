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
var _TestReader_config;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestReader = void 0;
const lodash_1 = __importDefault(require("lodash"));
const events_1 = require("events");
const utils_1 = require("../events/utils");
const sets_builder_1 = require("./sets-builder");
const test_parser_1 = require("./test-parser");
const events_2 = require("../events");
const env_1 = __importDefault(require("../utils/env"));
class TestReader extends events_1.EventEmitter {
    static create(...args) {
        return new this(...args);
    }
    constructor(config) {
        super();
        _TestReader_config.set(this, void 0);
        __classPrivateFieldSet(this, _TestReader_config, config, "f");
    }
    async read(options) {
        const { paths, browsers, ignore, sets, grep, runnableOpts } = options;
        const { fileExtensions } = __classPrivateFieldGet(this, _TestReader_config, "f").system;
        const envSets = env_1.default.parseCommaSeparatedValue(["TESTPLANE_SETS", "HERMIONE_SETS"]).value;
        const setCollection = await sets_builder_1.SetsBuilder.create(__classPrivateFieldGet(this, _TestReader_config, "f").sets, { defaultPaths: ["testplane", "hermione"] })
            .useFiles(paths)
            .useSets((sets || []).concat(envSets))
            .useBrowsers(browsers)
            .build(process.cwd(), { ignore }, fileExtensions);
        const testRunEnv = lodash_1.default.isArray(__classPrivateFieldGet(this, _TestReader_config, "f").system.testRunEnv)
            ? __classPrivateFieldGet(this, _TestReader_config, "f").system.testRunEnv[0]
            : __classPrivateFieldGet(this, _TestReader_config, "f").system.testRunEnv;
        const parser = new test_parser_1.TestParser({ testRunEnv });
        (0, utils_1.passthroughEvent)(parser, this, [events_2.MasterEvents.BEFORE_FILE_READ, events_2.MasterEvents.AFTER_FILE_READ]);
        await parser.loadFiles(setCollection.getAllFiles(), { config: __classPrivateFieldGet(this, _TestReader_config, "f"), runnableOpts });
        const filesByBro = setCollection.groupByBrowser();
        const testsByBro = lodash_1.default.mapValues(filesByBro, (files, browserId) => parser.parse(files, { browserId, config: __classPrivateFieldGet(this, _TestReader_config, "f").forBrowser(browserId), grep }));
        validateTests(testsByBro, options);
        return testsByBro;
    }
}
exports.TestReader = TestReader;
_TestReader_config = new WeakMap();
function validateTests(testsByBro, options) {
    const tests = lodash_1.default.flatten(Object.values(testsByBro));
    if (options.replMode?.enabled) {
        const testsToRun = tests.filter(test => !test.disabled && !test.pending);
        const browsersToRun = lodash_1.default.uniq(testsToRun.map(test => test.browserId));
        if (testsToRun.length !== 1) {
            throw new Error(`In repl mode only 1 test in 1 browser should be run, but found ${testsToRun.length} tests` +
                `${testsToRun.length === 0 ? ". " : ` that run in ${browsersToRun.join(", ")} browsers. `}` +
                `Try to specify cli-options: "--grep" and "--browser" or use "testplane.only.in" in the test file.`);
        }
    }
    if (!lodash_1.default.isEmpty(tests) && tests.some(test => !test.silentSkip)) {
        return;
    }
    const stringifiedOpts = convertOptions(lodash_1.default.omit(options, "replMode"));
    if (lodash_1.default.isEmpty(stringifiedOpts)) {
        throw new Error(`There are no tests found. Try to specify [${Object.keys(options).join(", ")}] options`);
    }
    else {
        throw new Error(`There are no tests found by the specified options:\n${stringifiedOpts}`);
    }
}
function convertOptions(obj) {
    let result = "";
    for (const key of lodash_1.default.keys(obj)) {
        if (!lodash_1.default.isEmpty(obj[key]) || obj[key] instanceof RegExp) {
            if (lodash_1.default.isArray(obj[key])) {
                result += `- ${key}: ${obj[key].join(", ")}\n`;
            }
            else {
                result += `- ${key}: ${obj[key]}\n`;
            }
        }
    }
    return result;
}
//# sourceMappingURL=index.js.map