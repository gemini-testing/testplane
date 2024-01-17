"use strict";
module.exports = class WorkerProcess {
    static create(...args) {
        return new WorkerProcess(...args);
    }
    constructor(process) {
        this._process = process;
    }
    send(...args) {
        if (!this._process.connected) {
            return false;
        }
        this._process.send(...args);
        return true;
    }
};
//# sourceMappingURL=worker-process.js.map