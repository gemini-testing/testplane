import { AsyncEmitter } from "../events";
type Constructor<T = object> = new (...args: any[]) => T;
export declare abstract class Runner extends AsyncEmitter {
    static create<T>(this: Constructor<T>, ...args: unknown[]): T;
    abstract run(...args: unknown[]): Promise<void>;
    abstract cancel(): void;
}
export {};
