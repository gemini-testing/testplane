export = RegularTestRunner;
declare class RegularTestRunner extends Runner {
    constructor(test: any, browserAgent: any);
    _test: any;
    _browserAgent: any;
    _browser: any;
    run(workers: any): Promise<void>;
    _emit(event: any): void;
    _runTest(workers: any): Promise<any>;
    _applyTestResults({ meta, testplaneCtx, history }: {
        meta: any;
        testplaneCtx?: {} | undefined;
        history?: any[] | undefined;
    }): void;
    _getTraceparent(): string;
    _getBrowser(): Promise<any>;
    _freeBrowser(browserState?: {}): Promise<void>;
}
import { Runner } from "../runner";
