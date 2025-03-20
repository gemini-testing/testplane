"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBrowserDownloadProgressBar = void 0;
const cli_progress_1 = require("cli-progress");
const createBrowserDownloadProgressBar = () => {
    const progressBar = new cli_progress_1.MultiBar({
        stopOnComplete: true,
        forceRedraw: true,
        autopadding: true,
        hideCursor: true,
        clearOnComplete: true,
        fps: 5,
        format: " [{bar}] | {filename} | {value}%",
    });
    const register = (browserName, browserVersion) => {
        let bar;
        const downloadProgressCallback = (done, total = 100) => {
            if (!bar) {
                bar = progressBar.create(100, 0, { filename: `${browserName}@${browserVersion}` });
            }
            const downloadedPercents = Math.floor((done / total) * 100);
            bar.update(downloadedPercents);
        };
        return downloadProgressCallback;
    };
    const stop = () => {
        progressBar.stop();
    };
    process.once("exit", stop);
    return { register, stop };
};
exports.createBrowserDownloadProgressBar = createBrowserDownloadProgressBar;
//# sourceMappingURL=cli-progress-bar.js.map