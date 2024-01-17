export = BrowserRunner;
declare class BrowserRunner extends Runner {
    constructor(browserId: any, config: any, browserPool: any, workers: any);
    _browserId: any;
    _config: any;
    _browserPool: any;
    _suiteMonitor: SuiteMonitor;
    _activeTestRunners: Set<any>;
    _workers: any;
    _running: PromiseGroup;
    get browserId(): any;
    run(testCollection: any): Promise<void>;
    addTestToRun(test: any): boolean;
    _runTest(test: any): Promise<void>;
    _passthroughEvents(runner: any, events: any): void;
}
import Runner = require("./runner");
import SuiteMonitor = require("./suite-monitor");
import PromiseGroup = require("./promise-group");
