import sinon, { SinonFakeTimers, SinonSpyCall, SinonStub } from "sinon";
import clearRequire from "clear-require";
import proxyquire from "proxyquire";
import { promiseDelay } from "../../src/utils/promise";
import { AsyncEmitter } from "src/events";

describe("src/signal-handler", () => {
    const sandbox = sinon.createSandbox();

    let signalHandler: AsyncEmitter;
    let clock: SinonFakeTimers;
    let processOnStub: SinonStub;
    let processExitStub: SinonStub;
    let originalExitCode: number | string | null | undefined;

    const getCallBySignal = (sig: string): SinonSpyCall => {
        return processOnStub.getCalls().find((call: SinonSpyCall) => call.args[0] === sig) as SinonSpyCall;
    };

    const sendSignal = (sig: string): void => {
        getCallBySignal(sig).args[1]();
    };

    beforeEach(() => {
        originalExitCode = process.exitCode;
        clock = sandbox.useFakeTimers({ now: 1000 });
        processOnStub = sandbox.stub(process, "on") as SinonStub;
        processExitStub = sandbox.stub(process, "exit") as SinonStub;

        clearRequire("src/signal-handler");
        signalHandler = proxyquire("src/signal-handler", {
            "./utils/logger": {
                log: sandbox.stub(),
            },
        }).default;
    });

    afterEach(() => {
        process.exitCode = originalExitCode;
        sandbox.restore();
    });

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
                assert.equal(process.exitCode, exitCode);

                return clock.tickAsync(20).then(() => {
                    assert.callOrder(handler, afterHandler, processExitStub);
                });
            });

            it("should force quit on second call", () => {
                sendSignal(signal);
                clock.tick(11);
                sendSignal(signal);

                assert.calledOnceWith(process.exit, exitCode);
            });

            it("should exit with the signal code if teardown rejects", async () => {
                signalHandler.on("exit", () => Promise.reject(new Error("teardown failed")));

                sendSignal(signal);
                await clock.tickAsync(0);

                assert.calledOnceWith(process.exit, exitCode);
            });

            it("should still emit runner end if exit teardown rejects", async () => {
                const onRunnerEnd = sandbox.stub().named("onRunnerEnd");
                signalHandler.on("exit", () => Promise.reject(new Error("teardown failed")));
                signalHandler.on("endRunner", onRunnerEnd);

                sendSignal(signal);
                await clock.tickAsync(0);

                assert.calledOnce(onRunnerEnd);
                assert.callOrder(onRunnerEnd, processExitStub);
            });
        });
    });
});
