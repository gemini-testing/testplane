export class MochaEventBus extends EventEmitter {
    static events: Mocha.SuiteConstants;
    static create(...args: any[]): MochaEventBus;
    constructor(rootSuite: any);
    #private;
}
import { EventEmitter } from "events";
import Mocha = require("mocha");
