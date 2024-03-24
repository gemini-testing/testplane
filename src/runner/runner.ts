import { Constructor } from "type-fest";
import { AsyncEmitter } from "../events/index.js";

export abstract class Runner extends AsyncEmitter {
    static create<T>(this: Constructor<T>, ...args: unknown[]): T {
        return new this(...args);
    }

    abstract run(...args: unknown[]): Promise<void>;

    abstract cancel(): void;
}
