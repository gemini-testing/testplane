import BaseReporter from "./base.js";
import { extendTestInfo } from "./utils/helpers.js";
import { SUCCESS, FAIL, RETRY, SKIPPED } from "../constants/test-statuses.js";

export default class JsonlReporter extends BaseReporter {
    _onTestPass(test) {
        const testInfo = extendTestInfo(test, { status: SUCCESS });
        this.informer.log(testInfo);
    }

    _onTestFail(test) {
        this.informer.log(extendTestInfo(test, { status: FAIL }));
    }

    _onRetry(test) {
        this.informer.log(extendTestInfo(test, { status: RETRY }));
    }

    _onTestPending(test) {
        this.informer.log(extendTestInfo(test, { status: SKIPPED }));
    }

    _onBeforeRunnerEnd() {
        // do nothing
    }

    _onWarning() {
        // do nothing
    }

    _onError() {
        // do nothing
    }

    _onInfo() {
        // do nothing
    }
}
