"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerProcess = void 0;
class WorkerProcess {
    static create(process) {
        return new this(process);
    }
    constructor(process) {
        this.process = process;
    }
    send(message) {
        if (!this.process.connected) {
            return false;
        }
        this.process.send(message);
        return true;
    }
}
exports.WorkerProcess = WorkerProcess;
//# sourceMappingURL=worker-process.js.map