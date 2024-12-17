import { MultiBar, type SingleBar } from "cli-progress";
import type { DownloadProgressCallback } from "../utils";

export type RegisterProgressBarFn = (browserName: string, browserVersion: string) => DownloadProgressCallback;

export const createBrowserDownloadProgressBar = (): { register: RegisterProgressBarFn; stop: () => void } => {
    const progressBar = new MultiBar({
        stopOnComplete: true,
        forceRedraw: true,
        autopadding: true,
        hideCursor: true,
        clearOnComplete: true,
        fps: 5,
        format: " [{bar}] | {filename} | {value}%",
    });

    const register: RegisterProgressBarFn = (browserName, browserVersion) => {
        let bar: SingleBar;

        const downloadProgressCallback: DownloadProgressCallback = (done, total = 100) => {
            if (!bar) {
                bar = progressBar.create(100, 0, { filename: `${browserName}@${browserVersion}` });
            }

            const downloadedPercents = Math.floor((done / total) * 100);

            bar.update(downloadedPercents);
        };

        return downloadProgressCallback;
    };

    const stop = (): void => {
        progressBar.stop();
    };

    process.once("exit", stop);

    return { register, stop };
};
