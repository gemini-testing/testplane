export = SuiteMonitor;
declare class SuiteMonitor extends EventEmitter {
    static create(): import("./suite-monitor");
    constructor();
    _suites: Map<any, any>;
    testBegin(test: any): void;
    _addTest(suite: any): void;
    testEnd(test: any): void;
    _rmTest(suite: any): void;
    testRetry(test: any): void;
    _addRetry(suite: any): void;
}
import { EventEmitter } from "events";
