import { type DownloadProgressCallback } from "../utils";
export declare const installUbuntuPackages: (packages: string[], destination: string, { downloadProgressCallback }: {
    downloadProgressCallback: DownloadProgressCallback;
}) => Promise<void>;
