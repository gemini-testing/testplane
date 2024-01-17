export = SimpleTestParser;
declare class SimpleTestParser extends EventEmitter {
    static create(...args: any[]): import("./simple-test-parser");
    constructor(config: any);
    _config: any;
    parse({ file, browserId }: {
        file: any;
        browserId: any;
    }): Promise<any>;
}
import { EventEmitter } from "events";
