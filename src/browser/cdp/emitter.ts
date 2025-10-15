import * as logger from "../../utils/logger";
import { EventEmitter } from "events";

export class CDPEventEmitter<Events extends { [key in keyof Events]: unknown }> extends EventEmitter {
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

        return super.on(event, eventListenerWithErrorBoundary);
    }
}
