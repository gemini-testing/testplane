import type { ConfigEnv } from "vite";
import type { WorkerInitMessage } from "./browser-modules/types"

export const MODULE_PREFIX = "@hermione";
export const MODULE_NAMES = {
    mocha: `${MODULE_PREFIX}/mocha`,
    browserRunner: `${MODULE_PREFIX}/browser-runner`,
    globals: `${MODULE_PREFIX}/globals`,
};

export const VITE_DEFAULT_CONFIG_ENV: ConfigEnv = {
    command: "serve",
    mode: process.env.NODE_ENV === "production" ? "production" : "development",
};

export const HERMIONE_BROWSER_EVENT_SUFFIX = "hermione:browser";

// TODO: use type from worker
export const WORKER_ENV_BY_RUN_UUID = new Map<string, WorkerInitMessage>;
