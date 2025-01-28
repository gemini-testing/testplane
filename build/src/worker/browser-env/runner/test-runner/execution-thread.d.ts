import NodejsEnvExecutionThread from "../../../runner/test-runner/execution-thread";
import type { WorkerViteSocket } from "./types";
export declare const wrapExecutionThread: (socket: WorkerViteSocket, throwIfAborted: () => void) => typeof NodejsEnvExecutionThread;
