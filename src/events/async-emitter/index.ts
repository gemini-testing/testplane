import { EventEmitter } from "events";
import { promiseMethod } from "../../utils/promise";

export class AsyncEmitter extends EventEmitter {
    async emitAndWait(event: string | symbol, ...args: unknown[]): Promise<unknown[]> {
        const results = await Promise.allSettled(
            this.listeners(event).map(l => promiseMethod(l as (...args: unknown[]) => unknown).apply(this, args as [])),
        );

        const rejected = results.find(({ status }) => status === "rejected");
        return rejected
            ? Promise.reject((rejected as PromiseRejectedResult).reason)
            : results.map(r => (r as PromiseFulfilledResult<unknown>).value);
    }
}
