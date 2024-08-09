"use strict";

import { EventEmitter } from "events";
import { passthroughEvent } from "../../events/utils";
import SimpleTestParser from "./simple-test-parser";
import { WorkerEvents } from "../../events";
import fastq from "fastq";
import { Config } from "../../config";
import { Test } from "../../test-reader/test-object";

export type ParseArgs = {
    file: string;
    browserId: string;
};

class SequenceTestParser extends EventEmitter {
    _parser: SimpleTestParser;
    _queue: fastq.queueAsPromised<() => Promise<Test[]>, Test[]>;
    static create<T extends SequenceTestParser>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this: new (...args: any[]) => T,
        ...args: ConstructorParameters<typeof SequenceTestParser>
    ): T {
        return new this(...args);
    }

    constructor(config: Config) {
        super();

        this._parser = SimpleTestParser.create(config);
        passthroughEvent(this._parser, this, [WorkerEvents.BEFORE_FILE_READ, WorkerEvents.AFTER_FILE_READ]);

        this._queue = fastq.promise(fn => fn(), 1);
    }

    async parse({ file, browserId }: ParseArgs): Promise<Test[]> {
        return this._queue.push(() => this._parser.parse({ file, browserId }));
    }
}

export default SequenceTestParser;
