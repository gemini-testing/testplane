import { type W3CBrowserName } from "../browser/types";
export declare const isSupportIsolation: (browserName: string, browserVersion?: string) => boolean;
export declare const getNormalizedBrowserName: (browserName?: string) => W3CBrowserName | null;
