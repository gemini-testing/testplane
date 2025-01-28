"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerEventNames = void 0;
const constants_1 = require("./constants");
var WorkerEventNames;
(function (WorkerEventNames) {
    WorkerEventNames["initialize"] = "worker:initialize";
    WorkerEventNames["finalize"] = "worker:finalize";
    WorkerEventNames["runRunnable"] = "worker:runRunnable";
})(WorkerEventNames || (exports.WorkerEventNames = WorkerEventNames = {}));
//# sourceMappingURL=types.js.map