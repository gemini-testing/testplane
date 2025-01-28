"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleTestParser = void 0;
const lodash_1 = __importDefault(require("lodash"));
const events_1 = require("events");
const utils_1 = require("../../events/utils");
const test_parser_1 = require("../../test-reader/test-parser");
const events_2 = require("../../events");
class SimpleTestParser extends events_1.EventEmitter {
    static create(...args) {
        return new this(...args);
    }
    constructor(config) {
        super();
        this._config = config;
    }
    async parse({ file, browserId }) {
        const testRunEnv = lodash_1.default.isArray(this._config.system.testRunEnv)
            ? this._config.system.testRunEnv[0]
            : this._config.system.testRunEnv;
        const parser = new test_parser_1.TestParser({ testRunEnv });
        (0, utils_1.passthroughEvent)(parser, this, [events_2.WorkerEvents.BEFORE_FILE_READ, events_2.WorkerEvents.AFTER_FILE_READ]);
        await parser.loadFiles([file], { config: this._config });
        return parser.parse([file], { browserId, config: this._config.forBrowser(browserId) });
    }
}
exports.SimpleTestParser = SimpleTestParser;
//# sourceMappingURL=simple-test-parser.js.map