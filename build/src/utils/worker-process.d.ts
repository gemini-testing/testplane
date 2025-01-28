/// <reference types="node" />
import { ChildProcess } from "child_process";
type Serializable = string | object | number | boolean | bigint;
export declare class WorkerProcess {
    protected process: ChildProcess;
    static create<T extends WorkerProcess>(this: new (process: ChildProcess) => T, process: ChildProcess): T;
    constructor(process: ChildProcess);
    send(message: Serializable): boolean;
}
export {};
