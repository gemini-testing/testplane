import { type W3CBrowserName } from "../browser/types";
export declare const resolveBrowserVersion: (browserName: W3CBrowserName, { force }?: {
    force?: boolean | undefined;
}) => Promise<string>;
