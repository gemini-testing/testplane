import { type W3CBrowserName } from "../browser/types";
export declare const WEBDRIVER_PROTOCOL = "webdriver";
export declare const DEVTOOLS_PROTOCOL = "devtools";
export declare const SAVE_HISTORY_MODE: {
    ALL: string;
    NONE: string;
    ONLY_FAILED: string;
};
export declare const NODEJS_TEST_RUN_ENV = "nodejs";
export declare const BROWSER_TEST_RUN_ENV = "browser";
export declare const LOCAL_GRID_URL = "local";
export declare const W3C_CAPABILITIES: string[];
export declare const VENDOR_CAPABILITIES: Record<W3CBrowserName, string[]>;
