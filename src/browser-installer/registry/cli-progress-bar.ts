import { MultiBar, type SingleBar } from "cli-progress";
import type { DownloadProgressCallback } from "../utils";
import { BYTES_PER_MEGABYTE } from "../constants";

export type RegisterProgressBarFn = (browserName: string, browserVersion: string) => DownloadProgressCallback;

export const createBrowserDownloadProgressBar = (): { register: RegisterProgressBarFn } => {
    const progressBar = new MultiBar({
        stopOnComplete: true,
        forceRedraw: true,
        autopadding: true,
        hideCursor: true,
        fps: 5,
        format: " [{bar}] | {filename} | {value}/{total} MB",
    });

    const register: RegisterProgressBarFn = (browserName, browserVersion) => {
        let bar: SingleBar;

        const downloadProgressCallback: DownloadProgressCallback = (downloadedBytes, totalBytes) => {
            if (!bar) {
                const totalMB = Math.round((totalBytes / BYTES_PER_MEGABYTE) * 100) / 100;
                bar = progressBar.create(totalMB, 0, { filename: `${browserName}@${browserVersion}` });
            }

            const downloadedMB = Math.round((downloadedBytes / BYTES_PER_MEGABYTE) * 100) / 100;

            bar.update(downloadedMB);
        };

        return downloadProgressCallback;
    };

    return { register };
};
