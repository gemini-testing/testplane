export = WorkerProcess;
declare class WorkerProcess {
    static create(...args: any[]): import("./worker-process");
    constructor(process: any);
    _process: any;
    send(...args: any[]): boolean;
}
