import * as logger from "../../utils/logger";
import { EventEmitter } from "events";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunc = (...args: any) => unknown;

export class CDPEventEmitter<Events extends { [key in keyof Events]: unknown }> extends EventEmitter {
    private _callbackMap: Map<AnyFunc, AnyFunc> = new Map();

    on<U extends string & keyof Events>(event: U, listener: (params: Events[U]) => void | Promise<void>): this {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eventListenerWithErrorBoundary = (params: Events[U]): void | Promise<void> => {
            const logError = (e: unknown): void => {
                logger.error(`Catched unhandled error in CDP "${event}" handler: ${(e && (e as Error).stack) || e}`);
            };

            try {
                const result = listener(params);

                return result instanceof Promise ? result.catch(logError) : result;
            } catch (e) {
                logError(e);
            }
        };

        this._callbackMap.set(listener, eventListenerWithErrorBoundary);

        return super.on(event, eventListenerWithErrorBoundary);
    }

    off<U extends string & keyof Events>(event: U, listener: (params: Events[U]) => void | Promise<void>): this {
        const eventListenerWithErrorBoundary = this._callbackMap.get(listener);

        if (eventListenerWithErrorBoundary) {
            this._callbackMap.delete(listener);
            super.off(event, eventListenerWithErrorBoundary);
        }

        return this;
    }
}
