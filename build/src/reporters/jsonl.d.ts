export = JsonlReporter;
declare class JsonlReporter extends BaseReporter {
    _onBeforeRunnerEnd(): void;
    _onWarning(): void;
    _onError(): void;
    _onInfo(): void;
}
import BaseReporter = require("./base");
