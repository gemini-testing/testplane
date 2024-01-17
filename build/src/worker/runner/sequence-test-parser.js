"use strict";
const { EventEmitter } = require("events");
const { passthroughEvent } = require("../../events/utils");
const SimpleTestParser = require("./simple-test-parser");
const { WorkerEvents } = require("../../events");
const fastq = require("fastq");
module.exports = class SequenceTestParser extends EventEmitter {
    static create(...args) {
        return new this(...args);
    }
    constructor(config) {
        super();
        this._parser = SimpleTestParser.create(config);
        passthroughEvent(this._parser, this, [WorkerEvents.BEFORE_FILE_READ, WorkerEvents.AFTER_FILE_READ]);
        this._queue = fastq.promise(fn => fn(), 1);
    }
    async parse({ file, browserId }) {
        return this._queue.push(() => this._parser.parse({ file, browserId }));
    }
};
//# sourceMappingURL=sequence-test-parser.js.map