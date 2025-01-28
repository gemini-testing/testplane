"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncEmitter = void 0;
const events_1 = require("events");
const bluebird_1 = __importDefault(require("bluebird"));
class AsyncEmitter extends events_1.EventEmitter {
    async emitAndWait(event, ...args) {
        const results = await Promise.allSettled(this.listeners(event).map(l => bluebird_1.default.method(l).apply(this, args)));
        const rejected = results.find(({ status }) => status === "rejected");
        return rejected
            ? Promise.reject(rejected.reason)
            : results.map(r => r.value);
    }
}
exports.AsyncEmitter = AsyncEmitter;
//# sourceMappingURL=index.js.map