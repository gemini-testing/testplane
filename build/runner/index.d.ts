/// <reference types="node" />
export = MainRunner;
declare class MainRunner extends Runner {
    constructor(config: any, interceptors: any);
    _config: any;
    _interceptors: any;
    _browserPool: import("../browser-pool/basic-pool") | null;
    _activeBrowserRunners: Map<any, any>;
    _running: PromiseGroup;
    _runned: boolean;
    _cancelled: boolean;
    _workersRegistry: WorkersRegistry;
    _workers: import("events") | null;
    init(): void;
    _isRunning(): boolean;
    run(testCollection: any, stats: any): Promise<void>;
    addTestToRun(test: any, browserId: any): boolean;
    _runTests(testCollection: any): Promise<any>;
    _runTestsInBrowser(testCollection: any, browserId: any): Promise<void>;
    _getEventsToPassthrough(): any[];
    _getEventsToIntercept(): any[];
    _interceptEvents(runner: any, events: any): void;
    _applyInterceptors({ event, data }: {
        event: any;
        data: any;
    } | undefined, interceptors: any): any;
    registerWorkers(workerFilepath: any, exportedMethods: any): import("events");
}
import Runner = require("./runner");
import PromiseGroup = require("./promise-group");
import WorkersRegistry = require("../utils/workers-registry");
