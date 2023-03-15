"use strict";

const WorkerProcess = require("src/utils/worker-process");

describe("WorkerProcess", () => {
    describe("send", () => {
        it("should pass message when child process is connected", () => {
            const childProcess = {
                connected: true,
                send: sinon.spy(),
            };
            const workerProcess = WorkerProcess.create(childProcess);

            const result = workerProcess.send("message");

            assert.isTrue(result);
            assert.calledOnceWith(childProcess.send, "message");
        });

        it("should return false when child process is not connected", () => {
            const childProcess = {
                connected: false,
                send: sinon.spy(),
            };
            const workerProcess = WorkerProcess.create(childProcess);

            const result = workerProcess.send("message");

            assert.isFalse(result);
            assert.notCalled(childProcess.send);
        });
    });
});
