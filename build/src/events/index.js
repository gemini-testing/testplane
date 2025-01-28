"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Events = exports.WorkerEvents = exports.MasterEvents = exports.MasterSyncEvents = exports.CommonSyncEvents = exports.RunnerSyncEvents = exports.MasterAsyncEvents = exports.TestReaderEvents = void 0;
__exportStar(require("./async-emitter"), exports);
__exportStar(require("./types"), exports);
exports.TestReaderEvents = {
    NEW_BUILD_INSTRUCTION: "newBuildInstruction",
};
exports.MasterAsyncEvents = {
    INIT: "init",
    RUNNER_START: "startRunner",
    RUNNER_END: "endRunner",
    SESSION_START: "startSession",
    SESSION_END: "endSession",
    EXIT: "exit",
};
exports.RunnerSyncEvents = {
    NEW_WORKER_PROCESS: "newWorkerProcess",
    SUITE_BEGIN: "beginSuite",
    SUITE_END: "endSuite",
    TEST_BEGIN: "beginTest",
    TEST_END: "endTest",
    TEST_PASS: "passTest",
    TEST_FAIL: "failTest",
    TEST_PENDING: "pendingTest",
    RETRY: "retry",
};
exports.CommonSyncEvents = {
    CLI: "cli",
    BEGIN: "begin",
    END: "end",
    BEFORE_FILE_READ: "beforeFileRead",
    AFTER_FILE_READ: "afterFileRead",
    AFTER_TESTS_READ: "afterTestsRead",
    INFO: "info",
    WARNING: "warning",
    ERROR: "err",
};
exports.MasterSyncEvents = {
    ...exports.RunnerSyncEvents,
    ...exports.CommonSyncEvents,
};
exports.MasterEvents = {
    ...exports.MasterAsyncEvents,
    ...exports.MasterSyncEvents,
};
exports.WorkerEvents = {
    INIT: exports.MasterEvents.INIT,
    BEFORE_FILE_READ: exports.MasterEvents.BEFORE_FILE_READ,
    AFTER_FILE_READ: exports.MasterEvents.AFTER_FILE_READ,
    AFTER_TESTS_READ: exports.MasterEvents.AFTER_TESTS_READ,
    NEW_BROWSER: "newBrowser",
    UPDATE_REFERENCE: "updateReference",
};
exports.Events = {
    ...exports.MasterEvents,
    ...exports.WorkerEvents,
};
//# sourceMappingURL=index.js.map