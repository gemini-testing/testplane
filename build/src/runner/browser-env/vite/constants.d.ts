import type { ConfigEnv } from "vite";
import type { WorkerInitializePayload } from "./browser-modules/types";
export declare const MODULE_PREFIX = "@testplane";
export declare const MODULE_NAMES: {
    mocha: string;
    browserRunner: string;
    globals: string;
};
export declare const VITE_DEFAULT_CONFIG_ENV: ConfigEnv;
export declare const VITE_RUN_UUID_ROUTE = "run-uuids";
export declare const BROWSER_EVENT_PREFIX = "browser";
export declare const SOCKET_MAX_TIMEOUT = 2147483647;
export declare const SOCKET_TIMED_OUT_ERROR = "operation has timed out";
export declare const WORKER_ENV_BY_RUN_UUID: Map<string, WorkerInitializePayload>;
export declare const MOCK_MODULE_NAME = "testplane";
export declare const DEFAULT_AUTOMOCK = false;
export declare const DEFAULT_AUTOMOCK_DIRECTORY = "__mocks__";
