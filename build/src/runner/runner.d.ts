import { Constructor } from "type-fest";
import { AsyncEmitter } from "../events";
export declare abstract class Runner extends AsyncEmitter {
    static create<T>(this: Constructor<T>, ...args: unknown[]): T;
    abstract run(...args: unknown[]): Promise<void>;
    abstract cancel(): void;
}
