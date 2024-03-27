import { prepareError } from "./errors/index.js";
import { BrowserEventNames, BrowserMessage, WorkerEventNames, WorkerMessage, WorkerMessageByEvent, BrowserInitMessage, BrowserRunnableResultMessage } from "./types.js";

const WAIT_MESSAGE_TIMEOUT = 30000;
const WAIT_MESSAGE_INTERVAL = 100;

interface WaitMessageOpts {
    cmdUuid: string;
    timeout?: number;
    interval?: number;
}

export class ViteBrowserCommunicator {
    #recievedMsgs: Map<string, WorkerMessage> = new Map();

    static create<T extends ViteBrowserCommunicator>(this: new () => T): T {
        return new this();
    }

    subscribeOnMessage<T extends WorkerEventNames>(event: WorkerEventNames, handler: (msg: WorkerMessageByEvent<T>) => Promise<void>): void {
        import.meta.hot?.on(event, (msg: WorkerMessageByEvent<T>) => {
            this.#recievedMsgs.set(msg.cmdUuid, msg);

            handler(msg);
        });
    }

    // TODO: use msg as type for specified event. How to do it?
    sendMessage(event: BrowserEventNames, msg?: Partial<BrowserMessage>): void {
        if (isMessageWithErrors(msg)) {
            msg.errors = msg.errors.map(prepareError);
        }

        import.meta.hot?.send(event, {
            pid: window.__hermione__.pid,
            runUuid: window.__hermione__.runUuid,
            cmdUuid: window.__hermione__.cmdUuid,
            ...msg,
        });
    }

    async waitMessage<T extends WorkerEventNames>({
        cmdUuid,
        timeout = WAIT_MESSAGE_TIMEOUT,
        interval = WAIT_MESSAGE_INTERVAL,
    }: WaitMessageOpts): Promise<WorkerMessageByEvent<T>> {
        return new Promise((resolve, reject) => {
            const timerId =
                timeout > 0
                    ? setTimeout(() => {
                          reject(new Error(`Didn't wait for message from worker in ${timeout} seconds`));
                      }, timeout)
                    : 0;

            const intervalId = setInterval(() => {
                const msg = this.#recievedMsgs.get(cmdUuid) as WorkerMessageByEvent<T>;

                if (!msg) {
                    return;
                }

                clearTimeout(timerId);
                clearInterval(intervalId);

                this.#recievedMsgs.delete(cmdUuid);

                resolve(msg);
            }, interval);
        });
    }
}

// async waitMessage<T extends BrowserEventNames>({
//     cmdUuid,
//     timeout = WAIT_MESSAGE_TIMEOUT,
//     interval = WAIT_MESSAGE_INTERVAL,
// }: WaitMessageOpts): Promise<BrowserPayloadByEvent<T>> {
//     return new Promise((resolve, reject) => {
//         const timerId =
//             timeout > 0
//                 ? setTimeout(() => {
//                         reject(new Error(`Didn't wait for message from browser in ${timeout} seconds`));
//                     }, timeout)
//                 : 0;

//         const intervalId = setInterval(() => {
//             const msg = this.#recievedMsgs.get(cmdUuid) as BrowserPayloadByEvent<T>;

//             if (!msg) {
//                 return;
//             }

//             clearTimeout(timerId);
//             clearInterval(intervalId);

//             this.#recievedMsgs.delete(cmdUuid);

//             resolve(msg);
//         }, interval);
//     });
// }

// TODO: can remove it ???
export const isMessageWithErrors = (msg?: Partial<BrowserMessage>): msg is BrowserInitMessage | BrowserRunnableResultMessage => {
    return Boolean(msg && msg.hasOwnProperty("errors"));
};
