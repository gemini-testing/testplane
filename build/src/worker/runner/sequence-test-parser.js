"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SequenceTestParser = void 0;
const events_1 = require("events");
const utils_1 = require("../../events/utils");
const simple_test_parser_1 = require("./simple-test-parser");
const events_2 = require("../../events");
const fastq_1 = __importDefault(require("fastq"));
class SequenceTestParser extends events_1.EventEmitter {
    static create(...args) {
        return new this(...args);
    }
    constructor(config) {
        super();
        this._parser = simple_test_parser_1.SimpleTestParser.create(config);
        (0, utils_1.passthroughEvent)(this._parser, this, [events_2.WorkerEvents.BEFORE_FILE_READ, events_2.WorkerEvents.AFTER_FILE_READ]);
        this._queue = fastq_1.default.promise(fn => fn(), 1);
    }
    async parse({ file, browserId }) {
        return this._queue.push(() => this._parser.parse({ file, browserId }));
    }
}
exports.SequenceTestParser = SequenceTestParser;
//# sourceMappingURL=sequence-test-parser.js.map