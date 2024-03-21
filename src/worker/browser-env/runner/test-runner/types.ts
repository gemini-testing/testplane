import { WORKER_EVENT_SUFFIX } from "./constants";

import type { Socket } from "socket.io-client";
import type { BrowserViteEvents, WorkerViteEvents } from "../../../../runner/browser-env/vite/types";

export enum WorkerEventNames {
    initialize = `${WORKER_EVENT_SUFFIX}:initialize`,
    finalize = `${WORKER_EVENT_SUFFIX}:finalize`,
    runRunnable = `${WORKER_EVENT_SUFFIX}:runRunnable`,
}

export type WorkerViteSocket = Socket<BrowserViteEvents, WorkerViteEvents>;
