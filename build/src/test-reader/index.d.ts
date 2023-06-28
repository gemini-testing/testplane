export = TestReader;
declare class TestReader extends EventEmitter {
    static create(...args: any[]): import(".");
    constructor(config: any);
    read(options?: {}): Promise<{
        [x: string]: any;
    }>;
    #private;
}
import { EventEmitter } from "events";
