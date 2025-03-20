export = InsistantTestRunner;
declare class InsistantTestRunner extends Runner {
    constructor(test: any, config: any, browserAgent: any);
    _test: any;
    _config: any;
    _browserConfig: any;
    _browserAgent: any;
    _retriesPerformed: number;
    _cancelled: boolean;
    run(workers: any): Promise<void>;
    _shouldRetry(test: any): boolean;
    get _retriesLeft(): number;
}
import { Runner } from "../runner";
