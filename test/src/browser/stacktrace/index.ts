import proxyquire from "proxyquire";
import sinon, { type SinonSpy } from "sinon";
import type { ConditionalKeys, SetReturnType } from "type-fest";
import { ShallowStackFrames, captureRawStackFrames } from "../../../../src/browser/stacktrace/utils";

type AnyFunc = (...args: any[]) => unknown; // eslint-disable-line @typescript-eslint/no-explicit-any

type ShallowStackFramesFunc = ConditionalKeys<ShallowStackFrames, AnyFunc>;
type ShallowStackFramesMock = Record<ShallowStackFramesFunc, SinonSpy>;

type RunWithStacktraceHooks = <T>(args: {
    stackFrames: ShallowStackFrames;
    fn: SetReturnType<AnyFunc, T>;
    stackFilterFunc?: AnyFunc;
}) => T;

describe("stacktrace", () => {
    const sandbox = sinon.createSandbox();

    let runWithStacktraceHooks: RunWithStacktraceHooks;
    let stackFrames: ShallowStackFramesMock;
    const applyStackFramesStub = sandbox.stub().returnsArg(0);
    let captureRawStackFramesSpy: SinonSpy;

    beforeEach(() => {
        captureRawStackFramesSpy = sandbox.spy(captureRawStackFrames);
        runWithStacktraceHooks = proxyquire("../../../../src/browser/stacktrace", {
            "./utils": {
                captureRawStackFrames: captureRawStackFramesSpy,
                applyStackFrames: applyStackFramesStub,
            },
        }).runWithStacktraceHooks;

        stackFrames = new ShallowStackFrames() as unknown as ShallowStackFramesMock;

        sandbox.spy(stackFrames, "enter");
        sandbox.spy(stackFrames, "leave");
        sandbox.spy(stackFrames, "getKey");
        sandbox.spy(stackFrames, "isNested");
    });

    afterEach(() => sandbox.restore());

    const runWithStacktraceHooks_ = <T>(fn: SetReturnType<AnyFunc, T>, stackFilterFunc?: AnyFunc): T =>
        runWithStacktraceHooks({
            stackFrames: stackFrames as unknown as ShallowStackFrames,
            fn,
            stackFilterFunc,
        });

    describe("runWithStacktraceHooks", () => {
        it("should run function and return its result", () => {
            const fn = sandbox.stub().returns("foo");

            const result = runWithStacktraceHooks_(fn);

            assert.equal(result, "foo");
        });

        it("should run function and resolve its result", async () => {
            const fn = sandbox.stub().resolves("foo");

            const result = await runWithStacktraceHooks_(fn);

            assert.equal(result, "foo");
        });

        it("should enter stack trace", () => {
            const fn = sandbox.stub().returns("foo");

            runWithStacktraceHooks_(fn);

            assert.calledOnce(stackFrames.enter);
        });

        it("should enter stack trace once with nested calls", () => {
            const fn = sandbox.stub().callsFake(() => {
                const nestedFirst = sandbox.stub().callsFake(() => {
                    const nestedSecond = sandbox.stub().callsFake(() => {
                        return runWithStacktraceHooks_(sandbox.stub());
                    });

                    return runWithStacktraceHooks_(nestedSecond);
                });

                return runWithStacktraceHooks_(nestedFirst);
            });

            runWithStacktraceHooks_(fn);

            assert.calledOnce(stackFrames.enter);
        });

        it("should leave stack trace after function resolved", async () => {
            const fn = sandbox.stub().resolves();

            await runWithStacktraceHooks_(fn);

            assert.callOrder(stackFrames.enter, fn, stackFrames.leave);
        });

        it("should enter stack trace multiple times with async loops", async () => {
            const promises: Promise<void>[] = [];

            for (let i = 0; i < 5; i++) {
                promises.push(runWithStacktraceHooks_(sandbox.stub().resolves()));
            }

            assert.callCount(stackFrames.enter, 5);
            assert.callCount(stackFrames.leave, 0);

            await Promise.all(promises);

            assert.callCount(stackFrames.leave, 5);
        });

        it("should apply preserved stacktrace when error occures", async () => {
            const fn = sandbox.stub().rejects(new Error("some\nmulti\nline\nessage"));

            let error: Error;

            await runWithStacktraceHooks_(fn).catch((err: Error) => {
                error = err;
            });

            assert.calledOnceWith(applyStackFramesStub, error!, captureRawStackFramesSpy.firstCall.returnValue);
            assert.calledOnce(stackFrames.leave);
        });
    });
});
