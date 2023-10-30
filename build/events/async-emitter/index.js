"use strict";
const { EventEmitter } = require("events");
const { method } = require("bluebird");
module.exports = class AsyncEmitter extends EventEmitter {
    async emitAndWait(event, ...args) {
        const results = await Promise.allSettled(this.listeners(event).map(l => method(l).apply(this, args)));
        const rejected = results.find(({ status }) => status === "rejected");
        return rejected ? Promise.reject(rejected.reason) : results.map(r => r.value);
    }
};
//# sourceMappingURL=index.js.map