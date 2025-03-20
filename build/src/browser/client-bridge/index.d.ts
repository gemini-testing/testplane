import { ClientBridge } from "./client-bridge";
import { ExistingBrowser } from "../existing-browser";
export { ClientBridge };
export declare const build: (browser: ExistingBrowser, opts?: {
    calibration?: {
        needsCompatLib?: boolean;
    };
}) => Promise<ClientBridge>;
