import sinon, { SinonSpyCall, SinonStub } from "sinon";
import clearRequire from "clear-require";
import proxyquire from "proxyquire";
import { promiseDelay } from "../../src/utils/promise";
import { AsyncEmitter } from "src/events";

describe("src/signal-handler", () => {
    const sandbox = sinon.createSandbox();

    let signalHandler: AsyncEmitter;
    let processOnStub: SinonStub;
    let processExitStub: SinonStub;

    const getCallBySignal = (sig: string): SinonSpyCall => {
        return processOnStub.getCalls().find((call: SinonSpyCall) => call.args[0] === sig) as SinonSpyCall;
    };

    const sendSignal = (sig: string): void => {
        getCallBySignal(sig).args[1]();
    };

    beforeEach(() => {
        processOnStub = sandbox.stub(process, "on") as SinonStub;
        processExitStub = sandbox.stub(process, "exit") as SinonStub;

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
                assert.calledWith(processOnStub, signal);
            });

            it("should emit and wait for exit", () => {
                const afterHandler = sandbox.stub().named("afterHandler");
                const handler = sandbox.stub().named("handler").returns(promiseDelay(10).then(afterHandler));
                signalHandler.on("exit", handler);

                sendSignal(signal);

                return promiseDelay(20).then(() => {
                    assert.callOrder(handler, afterHandler, processExitStub);
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
