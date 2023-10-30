export = SkippedTestRunner;
declare class SkippedTestRunner extends Runner {
    constructor(test: any);
    _test: any;
    _isSilentlySkipped({ silentSkip, parent }: {
        silentSkip: any;
        parent: any;
    }): any;
}
import Runner = require("../runner");
