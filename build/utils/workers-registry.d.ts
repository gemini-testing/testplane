export = WorkersRegistry;
declare class WorkersRegistry extends EventEmitter {
    static create(...args: any[]): import("./workers-registry");
    constructor(config: any);
    _config: any;
    _ended: boolean;
    _workerFarm: workerFarm.Workers | null;
    _registeredWorkers: any[];
    init(): void;
    end(): Promise<void>;
    isEnded(): boolean;
    register(workerFilepath: any, exportedMethods: any): EventEmitter;
    _createWorkerFarm(): workerFarm.Workers;
    _inspectParams(): {
        workerOptions: {
            execArgv: string[];
        };
        maxConcurrentWorkers: number;
        maxCallsPerWorker: number;
    } | undefined;
    _initChild(child: any): void;
}
import { EventEmitter } from "events";
import workerFarm = require("worker-farm");
