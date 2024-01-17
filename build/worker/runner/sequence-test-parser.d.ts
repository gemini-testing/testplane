export = SequenceTestParser;
declare class SequenceTestParser extends EventEmitter {
    static create(...args: any[]): import("./sequence-test-parser");
    constructor(config: any);
    _parser: SimpleTestParser;
    _queue: fastq.queueAsPromised<any, any>;
    parse({ file, browserId }: {
        file: any;
        browserId: any;
    }): Promise<any>;
}
import { EventEmitter } from "events";
import SimpleTestParser = require("./simple-test-parser");
import fastq = require("fastq");
