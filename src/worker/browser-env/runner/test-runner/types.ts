import { WORKER_EVENT_PREFIX } from "./constants";

import type { Socket } from "socket.io-client";
import type { BrowserViteEvents, WorkerViteEvents } from "../../../../runner/browser-env/vite/types";

export enum WorkerEventNames {
    initialize = `${WORKER_EVENT_PREFIX}:initialize`,
    finalize = `${WORKER_EVENT_PREFIX}:finalize`,
    runRunnable = `${WORKER_EVENT_PREFIX}:runRunnable`,
}

export type WorkerViteSocket = Socket<BrowserViteEvents, WorkerViteEvents>;
