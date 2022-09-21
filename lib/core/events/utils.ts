import type {EventEmitter} from 'events';

import type AsyncEmitter from './async-emitter';

type PassEventsFunc<To extends EventEmitter> = <From extends EventEmitter>(from: From, to: To, event: string | Array<string>) => void;

const mkPassthroughFn = <To extends EventEmitter>(methodName: To extends AsyncEmitter ? 'emitAndWait' : 'emit'): PassEventsFunc<To> => {
    const passEvents = <From extends EventEmitter>(from: From, to: To, event: string | Array<string>): void => {
        if (typeof event === 'string') {
            from.on(event, (...args: Array<unknown>) => to[methodName](event, ...args));

            return;
        }

        event.forEach((event) => passEvents(from, to, event));
    };

    return passEvents;
};

export const passthroughEvent = mkPassthroughFn<EventEmitter>('emit');
export const passthroughEventAsync = mkPassthroughFn<AsyncEmitter>('emitAndWait');
