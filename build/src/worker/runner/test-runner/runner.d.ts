import { Constructor } from "type-fest";
export declare abstract class Runner {
    static create<T>(this: Constructor<T>, ...args: unknown[]): T;
    abstract run(...args: unknown[]): Promise<void>;
}
