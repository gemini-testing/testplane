export = Hermione;
declare class Hermione extends BaseHermione {
    _runner: Runner;
    init(): Promise<void>;
    runTest(fullTitle: any, options: any): Promise<{
        hermioneCtx: any;
        meta: any;
    }>;
    isWorker(): boolean;
}
import BaseHermione = require("../base-hermione");
import Runner = require("./runner");
