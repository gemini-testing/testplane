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
var _TestReader_config, _a;
const _ = require("lodash");
const { EventEmitter } = require("events");
const { passthroughEvent } = require("../events/utils");
const SetsBuilder = require("./sets-builder");
const { TestParser } = require("./test-parser");
const Events = require("../constants/runner-events");
const env = require("../utils/env");
module.exports = (_a = class TestReader extends EventEmitter {
        static create(...args) {
            return new this(...args);
        }
        constructor(config) {
            super();
            _TestReader_config.set(this, void 0);
            __classPrivateFieldSet(this, _TestReader_config, config, "f");
        }
        async read(options = {}) {
            const { paths, browsers, ignore, sets, grep } = options;
            const { fileExtensions } = __classPrivateFieldGet(this, _TestReader_config, "f").system;
            const setCollection = await SetsBuilder.create(__classPrivateFieldGet(this, _TestReader_config, "f").sets, { defaultDir: require("../../package").name })
                .useFiles(paths)
                .useSets((sets || []).concat(env.parseCommaSeparatedValue("HERMIONE_SETS")))
                .useBrowsers(browsers)
                .build(process.cwd(), { ignore }, fileExtensions);
            const parser = new TestParser();
            passthroughEvent(parser, this, [Events.BEFORE_FILE_READ, Events.AFTER_FILE_READ]);
            await parser.loadFiles(setCollection.getAllFiles(), __classPrivateFieldGet(this, _TestReader_config, "f"));
            const filesByBro = setCollection.groupByBrowser();
            const testsByBro = _.mapValues(filesByBro, (files, browserId) => parser.parse(files, { browserId, config: __classPrivateFieldGet(this, _TestReader_config, "f").forBrowser(browserId), grep }));
            validateTests(testsByBro, options);
            return testsByBro;
        }
    },
    _TestReader_config = new WeakMap(),
    _a);
function validateTests(testsByBro, options) {
    const tests = _.flatten(Object.values(testsByBro));
    if (!_.isEmpty(tests) && tests.some(test => !test.silentSkip)) {
        return;
    }
    const stringifiedOpts = convertOptions(options);
    if (_.isEmpty(stringifiedOpts)) {
        throw new Error(`There are no tests found. Try to specify [${Object.keys(options).join(", ")}] options`);
    }
    else {
        throw new Error(`There are no tests found by the specified options:\n${stringifiedOpts}`);
    }
}
function convertOptions(obj) {
    let result = "";
    for (let key of _.keys(obj)) {
        if (!_.isEmpty(obj[key])) {
            if (_.isArray(obj[key])) {
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