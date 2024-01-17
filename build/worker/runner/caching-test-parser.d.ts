export = CachingTestParser;
declare class CachingTestParser extends EventEmitter {
    static create(...args: any[]): import("./caching-test-parser");
    constructor(config: any);
    _config: any;
    _cache: {};
    _sequenceTestParser: SequenceTestParser;
    parse({ file, browserId }: {
        file: any;
        browserId: any;
    }): Promise<any>;
    _getFromCache({ file, browserId }: {
        file: any;
        browserId: any;
    }): any;
    _putToCache(testsPromise: any, { file, browserId }: {
        file: any;
        browserId: any;
    }): void;
}
import { EventEmitter } from "events";
import SequenceTestParser = require("./sequence-test-parser");
