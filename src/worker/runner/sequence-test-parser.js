import { EventEmitter } from "node:events";
import fastq from "fastq";

import { passthroughEvent } from "../../events/utils.js";
import SimpleTestParser from "./simple-test-parser.js";
import { WorkerEvents } from "../../events/index.js";

export default class SequenceTestParser extends EventEmitter {
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
}
