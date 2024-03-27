import WebSocket from "ws";
import URI from "urijs";
import stringifySafe from "./serialize";
// import { WorkerEventNames } from "./types";
import logger from "../../utils/logger";

import type { SetOptional } from "type-fest";
import type { Config } from "../../config";
import type { WorkerPayload } from "./types";

import type { BrowserEventNames, BrowserPayload, BrowserPayloadByEvent } from "../../runner/browser-env/vite/types";

interface WaitMessageOpts {
    cmdUuid: string;
    timeout?: number;
    interval?: number;
}

const WS_CONNECTION_TIMEOUT = 5000;
const WAIT_MESSAGE_TIMEOUT = 5000;
const WAIT_MESSAGE_INTERVAL = 100;

type MessageListener = (msg: BrowserPayload) => Promise<void>;

export class ViteWorkerCommunicator {
    readonly #config: Config;
    #workerWs: WebSocket;
    #recievedMsgs: Map<string, BrowserPayload> = new Map();
    #msgListenersByRunUuid: Map<string, MessageListener[]> = new Map();

    static create<T extends ViteWorkerCommunicator>(this: new (config: Config) => T, config: Config): T {
        return new this(config);
    }

    constructor(config: Config) {
        this.#config = config;

        const viteWsUrl = new URI(this.#config.baseUrl).protocol("ws").toString();
        this.#workerWs = new WebSocket(viteWsUrl, "vite-hmr");

        this.#handleMessages();
    }

    #handleMessages(): void {
        const timerId = setTimeout(() => {
            throw new Error(`Could't open ws connection to Vite for ${WS_CONNECTION_TIMEOUT} seconds`);
        }, WS_CONNECTION_TIMEOUT);

        this.#workerWs.on("error", err => {
            throw err;
        });

        this.#workerWs.on("close", (code, reason) => {
            throw new Error(`Websocket connection to Vite is closed with code: ${code} and reason: ${reason}`);
        });

        this.#workerWs.on("open", () => {
            clearTimeout(timerId);

            // this.sendMessage({ event: WorkerEventNames.init, data: { pid: process.pid } });
        });

        this.#workerWs.on("message", buff => {
            let msg: BrowserPayload | undefined;

            try {
                msg = JSON.parse(buff.toString()) as BrowserPayload;
            } catch (err) {
                logger.warn(`Cannot parse message: ${buff.toString()}`);
                return;
            }

            if (!msg?.data?.cmdUuid) {
                return;
            }

            this.#recievedMsgs.set(msg.data.cmdUuid, msg);
            const listeners = this.#msgListenersByRunUuid.get(msg.data.runUuid) || [];

            for (const listener of listeners) {
                listener(msg);
            }
        });
    }

    addListenerByRunUuid(runUuid: string, listener: MessageListener) {
        if (!this.#msgListenersByRunUuid.has(runUuid)) {
            this.#msgListenersByRunUuid.set(runUuid, [listener]);
        } else {
            this.#msgListenersByRunUuid.get(runUuid)!.push(listener);
        }
    }

    removeListenersByRunUuid(runUuid: string) {
        this.#msgListenersByRunUuid.delete(runUuid);
    }

    sendMessage(payload: SetOptional<WorkerPayload, "type">): void {
        // this.#workerWs.send(JSON.stringify({ type: "custom", ...payload }));
        this.#workerWs.send(stringifySafe({ type: "custom", ...payload }));
    }

    async waitMessage<T extends BrowserEventNames>({
        cmdUuid,
        timeout = WAIT_MESSAGE_TIMEOUT,
        interval = WAIT_MESSAGE_INTERVAL,
    }: WaitMessageOpts): Promise<BrowserPayloadByEvent<T>> {
        return new Promise((resolve, reject) => {
            const timerId =
                timeout > 0
                    ? setTimeout(() => {
                          reject(new Error(`Didn't wait for message from browser in ${timeout} seconds`));
                      }, timeout)
                    : 0;

            const intervalId = setInterval(() => {
                const msg = this.#recievedMsgs.get(cmdUuid) as BrowserPayloadByEvent<T>;

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
