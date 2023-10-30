export = events;
declare let events: {
    NEW_WORKER_PROCESS: string;
    SUITE_BEGIN: string;
    SUITE_END: string;
    TEST_BEGIN: string;
    TEST_END: string;
    TEST_PASS: string;
    TEST_FAIL: string;
    TEST_PENDING: string;
    RETRY: string;
} & {
    CLI: string;
    BEGIN: string;
    END: string;
    BEFORE_FILE_READ: string;
    AFTER_FILE_READ: string;
    AFTER_TESTS_READ: string;
    INFO: string;
    WARNING: string;
    ERROR: string;
} & {
    INIT: string;
    RUNNER_START: string;
    RUNNER_END: string;
    SESSION_START: string;
    SESSION_END: string;
    EXIT: string;
};
