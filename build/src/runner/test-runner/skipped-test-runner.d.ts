export = SkippedTestRunner;
declare class SkippedTestRunner extends Runner {
    constructor(test: any);
    _test: any;
    run(): void;
    _isSilentlySkipped({ silentSkip, parent }: {
        silentSkip: any;
        parent: any;
    }): any;
}
import { Runner } from "../runner";
