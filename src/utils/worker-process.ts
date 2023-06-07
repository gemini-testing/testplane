import { ChildProcess } from "child_process";

export class WorkerProcess {
    protected process: ChildProcess;

    static create<T extends WorkerProcess>(this: new (process: ChildProcess) => T, process: ChildProcess): T {
        return new this(process);
    }

    constructor(process: ChildProcess) {
        this.process = process;
    }

    send(message: unknown): boolean {
        if (!this.process.connected) {
            return false;
        }

        this.process.send(message);

        return true;
    }
}
