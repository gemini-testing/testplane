import type { Socket } from "socket.io-client";
import type { BrowserViteEvents, WorkerViteEvents } from "../../../../runner/browser-env/vite/types";
export declare enum WorkerEventNames {
    initialize = "worker:initialize",
    finalize = "worker:finalize",
    runRunnable = "worker:runRunnable"
}
export type WorkerViteSocket = Socket<BrowserViteEvents, WorkerViteEvents>;
