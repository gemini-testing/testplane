export = BaseHermione;
declare class BaseHermione extends AsyncEmitter {
    static create(config: any): import("./base-hermione");
    constructor(config: any);
    _interceptors: any[];
    _config: Config;
    _init(): globalThis.Promise<any>;
    get config(): Config;
    get events(): {
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
    } & {
        INIT: string;
        BEFORE_FILE_READ: string;
        AFTER_FILE_READ: string;
        AFTER_TESTS_READ: string;
        TEST_FAIL: string;
        ERROR: string;
        NEW_BROWSER: string;
        UPDATE_REFERENCE: string;
    };
    get errors(): typeof Errors;
    intercept(event: any, handler: any): import("./base-hermione");
    isWorker(): void;
    _loadPlugins(): void;
}
import AsyncEmitter = require("./events/async-emitter");
import Config = require("./config");
import Errors = require("./errors");
