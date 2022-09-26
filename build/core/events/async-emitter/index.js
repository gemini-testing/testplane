"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const bluebird_1 = __importDefault(require("bluebird"));
const events_1 = require("events");
const promise_utils_1 = require("../../promise-utils");
class AsyncEmitter extends events_1.EventEmitter {
    emitAndWait(event, ...args) {
        return (0, lodash_1.default)(this.listeners(event))
            .map((l) => bluebird_1.default.method(l).apply(this, args))
            .thru(promise_utils_1.waitForResults)
            .value();
    }
}
exports.default = AsyncEmitter;
;
