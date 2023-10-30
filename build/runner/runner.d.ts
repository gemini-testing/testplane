export = Runner;
declare class Runner extends AsyncEmitter {
    static create(...args: any[]): import("./runner");
    run(): void;
    cancel(): void;
}
import AsyncEmitter = require("../events/async-emitter");
