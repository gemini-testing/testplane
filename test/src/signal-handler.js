"use strict";

const clearRequire = require("clear-require");
const Promise = require("bluebird");
const proxyquire = require("proxyquire");

describe("src/signal-handler", () => {
    const sandbox = sinon.createSandbox();

    let signalHandler;

    const getCallBySignal = sig => {
        return process.on.getCalls().find(call => call.args[0] === sig);
    };

    const sendSignal = sig => {
        getCallBySignal(sig).args[1]();
    };

    beforeEach(() => {
        sandbox.stub(process, "on");
        sandbox.stub(process, "exit");

        clearRequire("src/signal-handler");
        signalHandler = proxyquire("src/signal-handler", {
            "./utils/logger": {
                log: sandbox.stub(),
            },
        });
    });

    afterEach(() => sandbox.restore());

    [
        { signal: "SIGHUP", exitCode: 129 },
        { signal: "SIGINT", exitCode: 130 },
        { signal: "SIGTERM", exitCode: 143 },
    ].forEach(({ signal, exitCode }) => {
        describe(signal, () => {
            it(`should subscribe to ${signal} event`, () => {
                assert.calledWith(process.on, signal);
            });

            it("should emit and wait for exit", () => {
                const afterHandler = sandbox.stub().named("afterHandler");
                const handler = sandbox.stub().named("handler").returns(Promise.delay(10).then(afterHandler));
                signalHandler.on("exit", handler);

                sendSignal(signal);

                return Promise.delay(20).then(() => {
                    assert.callOrder(handler, afterHandler, process.exit);
                });
            });

            it("should force quit on second call", () => {
                sendSignal(signal);
                sendSignal(signal);

                assert.calledOnceWith(process.exit, exitCode);
            });
        });
    });
});
