import type { ChildProcess } from "child_process";

export default class WorkerProcess {
    private _process: ChildProcess;

    public static create(process: ChildProcess): WorkerProcess {
        return new WorkerProcess(process);
    }

    constructor(process: ChildProcess) {
        this._process = process;
    }

    public send(...args: Parameters<typeof this._process.send>): boolean {
        if (!this._process.connected) {
            return false;
        }

        this._process.send(...args);

        return true;
    }
};
