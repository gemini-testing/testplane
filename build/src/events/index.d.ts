export * from "./async-emitter";
export * from "./types";
type ValueOf<T> = T[keyof T];
export declare const TestReaderEvents: {
    readonly NEW_BUILD_INSTRUCTION: "newBuildInstruction";
};
export type TestReaderEvents = typeof TestReaderEvents;
export type TestReaderEvent = ValueOf<TestReaderEvents>;
export declare const MasterAsyncEvents: {
    readonly INIT: "init";
    readonly RUNNER_START: "startRunner";
    readonly RUNNER_END: "endRunner";
    readonly SESSION_START: "startSession";
    readonly SESSION_END: "endSession";
    readonly EXIT: "exit";
};
export type MasterAsyncEvents = typeof MasterAsyncEvents;
export type MasterAsyncEvent = ValueOf<MasterAsyncEvents>;
export declare const RunnerSyncEvents: {
    readonly NEW_WORKER_PROCESS: "newWorkerProcess";
    readonly SUITE_BEGIN: "beginSuite";
    readonly SUITE_END: "endSuite";
    readonly TEST_BEGIN: "beginTest";
    readonly TEST_END: "endTest";
    readonly TEST_PASS: "passTest";
    readonly TEST_FAIL: "failTest";
    readonly TEST_PENDING: "pendingTest";
    readonly RETRY: "retry";
};
export type RunnerSyncEvents = typeof RunnerSyncEvents;
export type RunnerSyncEvent = ValueOf<RunnerSyncEvents>;
export declare const CommonSyncEvents: {
    readonly CLI: "cli";
    readonly BEGIN: "begin";
    readonly END: "end";
    readonly BEFORE_FILE_READ: "beforeFileRead";
    readonly AFTER_FILE_READ: "afterFileRead";
    readonly AFTER_TESTS_READ: "afterTestsRead";
    readonly INFO: "info";
    readonly WARNING: "warning";
    readonly ERROR: "err";
};
export type CommonSyncEvents = typeof CommonSyncEvents;
export type CommonSyncEvent = ValueOf<CommonSyncEvents>;
export declare const MasterSyncEvents: {
    CLI: "cli";
    BEGIN: "begin";
    END: "end";
    BEFORE_FILE_READ: "beforeFileRead";
    AFTER_FILE_READ: "afterFileRead";
    AFTER_TESTS_READ: "afterTestsRead";
    INFO: "info";
    WARNING: "warning";
    ERROR: "err";
    NEW_WORKER_PROCESS: "newWorkerProcess";
    SUITE_BEGIN: "beginSuite";
    SUITE_END: "endSuite";
    TEST_BEGIN: "beginTest";
    TEST_END: "endTest";
    TEST_PASS: "passTest";
    TEST_FAIL: "failTest";
    TEST_PENDING: "pendingTest";
    RETRY: "retry";
};
export type MasterSyncEvents = typeof MasterSyncEvents;
export type MasterSyncEvent = RunnerSyncEvent | CommonSyncEvent;
export declare const MasterEvents: {
    readonly CLI: "cli";
    readonly BEGIN: "begin";
    readonly END: "end";
    readonly BEFORE_FILE_READ: "beforeFileRead";
    readonly AFTER_FILE_READ: "afterFileRead";
    readonly AFTER_TESTS_READ: "afterTestsRead";
    readonly INFO: "info";
    readonly WARNING: "warning";
    readonly ERROR: "err";
    readonly NEW_WORKER_PROCESS: "newWorkerProcess";
    readonly SUITE_BEGIN: "beginSuite";
    readonly SUITE_END: "endSuite";
    readonly TEST_BEGIN: "beginTest";
    readonly TEST_END: "endTest";
    readonly TEST_PASS: "passTest";
    readonly TEST_FAIL: "failTest";
    readonly TEST_PENDING: "pendingTest";
    readonly RETRY: "retry";
    readonly INIT: "init";
    readonly RUNNER_START: "startRunner";
    readonly RUNNER_END: "endRunner";
    readonly SESSION_START: "startSession";
    readonly SESSION_END: "endSession";
    readonly EXIT: "exit";
};
export type MasterEvents = typeof MasterEvents;
export type MasterEvent = MasterAsyncEvent | MasterSyncEvent;
export declare const WorkerEvents: {
    readonly INIT: "init";
    readonly BEFORE_FILE_READ: "beforeFileRead";
    readonly AFTER_FILE_READ: "afterFileRead";
    readonly AFTER_TESTS_READ: "afterTestsRead";
    readonly NEW_BROWSER: "newBrowser";
    readonly UPDATE_REFERENCE: "updateReference";
};
export type WorkerEvents = typeof WorkerEvents;
export type WorkerEvent = ValueOf<WorkerEvents>;
export type InterceptedEvent = ValueOf<Pick<typeof RunnerSyncEvents, "SUITE_BEGIN" | "SUITE_END" | "TEST_BEGIN" | "TEST_END" | "TEST_PASS" | "TEST_FAIL" | "TEST_PENDING" | "RETRY">>;
export declare const Events: {
    readonly INIT: "init";
    readonly BEFORE_FILE_READ: "beforeFileRead";
    readonly AFTER_FILE_READ: "afterFileRead";
    readonly AFTER_TESTS_READ: "afterTestsRead";
    readonly NEW_BROWSER: "newBrowser";
    readonly UPDATE_REFERENCE: "updateReference";
    readonly CLI: "cli";
    readonly BEGIN: "begin";
    readonly END: "end";
    readonly INFO: "info";
    readonly WARNING: "warning";
    readonly ERROR: "err";
    readonly NEW_WORKER_PROCESS: "newWorkerProcess";
    readonly SUITE_BEGIN: "beginSuite";
    readonly SUITE_END: "endSuite";
    readonly TEST_BEGIN: "beginTest";
    readonly TEST_END: "endTest";
    readonly TEST_PASS: "passTest";
    readonly TEST_FAIL: "failTest";
    readonly TEST_PENDING: "pendingTest";
    readonly RETRY: "retry";
    readonly RUNNER_START: "startRunner";
    readonly RUNNER_END: "endRunner";
    readonly SESSION_START: "startSession";
    readonly SESSION_END: "endSession";
    readonly EXIT: "exit";
};
export type Events = typeof Events;
