export = FlatReporter;
declare class FlatReporter extends BaseReporter {
    constructor(...args: any[]);
    _tests: any[];
}
import BaseReporter = require("./base");
