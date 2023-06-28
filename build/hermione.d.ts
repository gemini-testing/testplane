export = Hermione;
declare class Hermione extends BaseHermione {
    _failed: boolean;
    extendCli(parser: any): void;
    run(testPaths: any, { browsers, sets, grep, updateRefs, requireModules, inspectMode, reporters }?: {
        browsers: any;
        sets: any;
        grep: any;
        updateRefs: any;
        requireModules: any;
        inspectMode: any;
        reporters?: any[] | undefined;
    }): Promise<boolean>;
    _runner: import("./runner/runner") | undefined;
    _readTests(testPaths: any, opts: any): Promise<TestCollection>;
    addTestToRun(test: any, browserId: any): any;
    readTests(testPaths: any, { browsers, sets, grep, silent, ignore }?: {
        browsers: any;
        sets: any;
        grep: any;
        silent: any;
        ignore: any;
    }): Promise<TestCollection>;
    isFailed(): boolean;
    _fail(): void;
    isWorker(): boolean;
    halt(err: any, timeout?: number): void;
}
import BaseHermione = require("./base-hermione");
import TestCollection_1 = require("./test-collection");
import TestCollection = TestCollection_1.default;
