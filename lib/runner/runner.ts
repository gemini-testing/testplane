import { events } from 'gemini-core';
import { Constructor } from '../types/utils';

export default abstract class Runner extends events.AsyncEmitter {
    public static create<T extends Runner>(this: Constructor<T>, ...args: Array<any>): T {
        return new this(...args);
    }

    public abstract run(...args: Array<unknown>): Promise<void>;

    public abstract cancel(): void;
};
