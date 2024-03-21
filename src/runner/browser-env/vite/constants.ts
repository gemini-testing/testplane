import type { ConfigEnv } from "vite";
import type { WorkerInitializePayload } from "./browser-modules/types";

export const MODULE_PREFIX = "@testplane";
export const MODULE_NAMES = {
    mocha: `${MODULE_PREFIX}/mocha`,
    browserRunner: `${MODULE_PREFIX}/browser-runner`,
    globals: `${MODULE_PREFIX}/globals`,
};

export const VITE_DEFAULT_CONFIG_ENV: ConfigEnv = {
    command: "serve",
    mode: process.env.NODE_ENV === "production" ? "production" : "development",
};

export const BROWSER_EVENT_SUFFIX = "browser";

export const SOCKET_MAX_TIMEOUT = 2147483647;
export const SOCKET_TIMED_OUT_ERROR = "operation has timed out";

export const WORKER_ENV_BY_RUN_UUID = new Map<string, WorkerInitializePayload>();
