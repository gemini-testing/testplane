import { HERMIONE_WORKER_EVENT_SUFFIX } from "./constants";
import type { WorkerMessageEvents } from "./../../runner/browser-env/vite/browser-modules/types";
import type { ViteWorkerCommunicator } from "./communicator";
import type { RuntimeConfig } from "../../config/types";

export interface BrowserEnvRuntimeConfig extends RuntimeConfig {
    viteWorkerCommunicator: ViteWorkerCommunicator;
}

// TODO: rename worker INIT event -> worker:startSession
// TODO: add event -> worker:endSession
// TODO: move types from browser-env to this file after migrate to esm
export enum WorkerEventNames {
    init = `${HERMIONE_WORKER_EVENT_SUFFIX}:init`,
    runRunnable = `${HERMIONE_WORKER_EVENT_SUFFIX}:runRunnable`,
    commandResult = `${HERMIONE_WORKER_EVENT_SUFFIX}:commandResult`,
}

export type WorkerPayloadByEvent<T extends WorkerEventNames> = {
    event: T,
    type: "custom",
    data: WorkerMessageEvents[T];
}
export type WorkerPayload = WorkerPayloadByEvent<WorkerEventNames>;

export { WorkerMessageEvents, WorkerInitMessage, WorkerRunRunnableMessage, WorkerCommandResultMessage, WorkerMessageByEvent, WorkerMessage } from "./../../runner/browser-env/vite/browser-modules/types";
