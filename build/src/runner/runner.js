"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Runner = void 0;
const events_1 = require("../events");
class Runner extends events_1.AsyncEmitter {
    static create(...args) {
        return new this(...args);
    }
}
exports.Runner = Runner;
//# sourceMappingURL=runner.js.map