import { AsyncEmitter } from "../events";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = object> = new (...args: any[]) => T;

export abstract class CancelableEmitter extends AsyncEmitter {
    static create<T>(this: Constructor<T>, ...args: unknown[]): T {
        return new this(...args);
    }

    abstract cancel(error: Error): void;
}

export abstract class RunnableEmitter extends CancelableEmitter {
    abstract run(...args: unknown[]): Promise<void>;
}
