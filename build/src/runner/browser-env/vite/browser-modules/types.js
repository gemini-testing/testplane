import { BROWSER_EVENT_PREFIX, WORKER_EVENT_PREFIX } from "./constants.js";
export var BrowserEventNames;
(function (BrowserEventNames) {
    BrowserEventNames["initialize"] = "browser:initialize";
    BrowserEventNames["runBrowserCommand"] = "browser:runBrowserCommand";
    BrowserEventNames["runExpectMatcher"] = "browser:runExpectMatcher";
    BrowserEventNames["callConsoleMethod"] = "browser:callConsoleMethod";
    BrowserEventNames["reconnect"] = "browser:reconnect";
})(BrowserEventNames || (BrowserEventNames = {}));
// TODO: use from nodejs code when migrate to esm
export var WorkerEventNames;
(function (WorkerEventNames) {
    WorkerEventNames["initialize"] = "worker:initialize";
    WorkerEventNames["finalize"] = "worker:finalize";
    WorkerEventNames["runRunnable"] = "worker:runRunnable";
})(WorkerEventNames || (WorkerEventNames = {}));
//# sourceMappingURL=types.js.map