import { ValueOf } from "type-fest";

export * from "./async-emitter";
export * from "./types";

export const TestReaderEvents = {
    NEW_BUILD_INSTRUCTION: "newBuildInstruction",
} as const;

export type TestReaderEvents = typeof TestReaderEvents;

export type TestReaderEvent = ValueOf<TestReaderEvents>;

export const MasterAsyncEvents = {
    INIT: "init",

    RUNNER_START: "startRunner",
    RUNNER_END: "endRunner",

    SESSION_START: "startSession",
    SESSION_END: "endSession",

    EXIT: "exit",
} as const;

export type MasterAsyncEvents = typeof MasterAsyncEvents;

export type MasterAsyncEvent = ValueOf<MasterAsyncEvents>;

export const RunnerSyncEvents = {
    NEW_WORKER_PROCESS: "newWorkerProcess",

    SUITE_BEGIN: "beginSuite",
    SUITE_END: "endSuite",

    TEST_BEGIN: "beginTest",
    TEST_END: "endTest",

    TEST_PASS: "passTest",
    TEST_FAIL: "failTest",
    TEST_PENDING: "pendingTest",

    RETRY: "retry",
} as const;

export type RunnerSyncEvents = typeof RunnerSyncEvents;

export type RunnerSyncEvent = ValueOf<RunnerSyncEvents>;

export const CommonSyncEvents = {
    CLI: "cli",

    BEGIN: "begin",
    END: "end",

    BEFORE_FILE_READ: "beforeFileRead",
    AFTER_FILE_READ: "afterFileRead",

    AFTER_TESTS_READ: "afterTestsRead",

    INFO: "info",
    WARNING: "warning",
    ERROR: "err",
} as const;

export type CommonSyncEvents = typeof CommonSyncEvents;

export type CommonSyncEvent = ValueOf<CommonSyncEvents>;

export const MasterSyncEvents = {
    ...RunnerSyncEvents,
    ...CommonSyncEvents,
};

export type MasterSyncEvents = typeof MasterSyncEvents;

export type MasterSyncEvent = RunnerSyncEvent | CommonSyncEvent;

export const MasterEvents = {
    ...MasterAsyncEvents,
    ...MasterSyncEvents,
} as const;

export type MasterEvents = typeof MasterEvents;

export type MasterEvent = MasterAsyncEvent | MasterSyncEvent;

export const WorkerEvents = {
    INIT: MasterEvents.INIT,

    BEFORE_FILE_READ: MasterEvents.BEFORE_FILE_READ,
    AFTER_FILE_READ: MasterEvents.AFTER_FILE_READ,

    AFTER_TESTS_READ: MasterEvents.AFTER_TESTS_READ,

    NEW_BROWSER: "newBrowser",

    UPDATE_REFERENCE: "updateReference",
} as const;

export type WorkerEvents = typeof WorkerEvents;

export type WorkerEvent = ValueOf<WorkerEvents>;

export type InterceptedEvent = ValueOf<
    Pick<
        typeof RunnerSyncEvents,
        "SUITE_BEGIN" | "SUITE_END" | "TEST_BEGIN" | "TEST_END" | "TEST_PASS" | "TEST_FAIL" | "TEST_PENDING" | "RETRY"
    >
>;

export const Events = {
    ...MasterEvents,
    ...WorkerEvents,
} as const;

export type Events = typeof Events;
