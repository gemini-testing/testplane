import { AsyncEmitter } from "../events";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = object> = new (...args: any[]) => T;

export abstract class Runner extends AsyncEmitter {
    static create<T>(this: Constructor<T>, ...args: unknown[]): T {
        return new this(...args);
    }

    abstract run(...args: unknown[]): Promise<void>;

    abstract cancel(): void;
}
