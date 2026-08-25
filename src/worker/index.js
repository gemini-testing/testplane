"use strict";

const TestplaneFacade = require("./testplane-facade");
const ipc = require("../utils/ipc");
const {
    MASTER_PROFILER_FLUSH,
    WORKER_PROFILER_BATCH,
    WORKER_PROFILER_FLUSHED,
} = require("../constants/process-messages");

const testplaneFacade = TestplaneFacade.create();
Promise.resolve(testplaneFacade.init()).then(async () => {
    const level = typeof testplaneFacade.profilerLevel === "function" ? await testplaneFacade.profilerLevel() : 0;
    if (!level) {
        return;
    }

    const intervalMs = level === 1 ? 500 : level === 2 ? 250 : 100;
    let batchPending = false;
    setInterval(() => {
        if (batchPending) {
            return;
        }
        batchPending = true;
        testplaneFacade
            .flushProfiler()
            .then(fragment => {
                if (fragment) {
                    ipc.emit(WORKER_PROFILER_BATCH, { fragment, workerPid: process.pid });
                }
            })
            .catch(error => {
                ipc.emit(WORKER_PROFILER_BATCH, {
                    workerPid: process.pid,
                    error: String(error?.message || error),
                });
            })
            .finally(() => {
                batchPending = false;
            });
    }, intervalMs).unref();
});

ipc.on(MASTER_PROFILER_FLUSH, ({ requestId }) => {
    testplaneFacade.flushProfiler().then(
        fragment => ipc.emit(WORKER_PROFILER_FLUSHED, { requestId, fragment, workerPid: process.pid }),
        error =>
            ipc.emit(WORKER_PROFILER_FLUSHED, {
                requestId,
                workerPid: process.pid,
                error: String(error?.message || error),
            }),
    );
});

exports.runTest = (fullTitle, options) => {
    return testplaneFacade.runTest(fullTitle, options);
};

exports.cancel = () => {
    return testplaneFacade.cancel();
};
