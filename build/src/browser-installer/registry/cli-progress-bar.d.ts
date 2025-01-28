import type { DownloadProgressCallback } from "../utils";
export type RegisterProgressBarFn = (browserName: string, browserVersion: string) => DownloadProgressCallback;
export declare const createBrowserDownloadProgressBar: () => {
    register: RegisterProgressBarFn;
    stop: () => void;
};
