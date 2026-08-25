import path from "node:path";
import esbuild from "esbuild";
import sinon, { type SinonStub } from "sinon";

interface TestSocket {
    on: SinonStub;
    emit: SinonStub;
}

interface TestWindow {
    Mocha: object;
    __testplane__: {
        browser: object;
        errors: unknown[];
        profilerLevel: 3;
        socket: TestSocket;
    };
}

interface TestGlobals {
    window?: TestWindow;
    document?: { querySelector: SinonStub };
    mocha?: { suite: object };
}

interface TestMochaWrapper {
    _subscribeOnWorkerMessages(): void;
    _runnables: Map<string, { fn: SinonStub }>;
}

interface MochaWrapperConstructor {
    create(): TestMochaWrapper;
}

type RunRunnableHandler = (payload: { fullTitle: string }, callback: SinonStub) => Promise<void>;

const browserGlobals = global as unknown as TestGlobals;

describe("runner/browser-env/vite/browser-modules/mocha", () => {
    const sandbox = sinon.createSandbox();

    let MochaWrapper: MochaWrapperConstructor;
    let originalWindow: TestWindow | undefined;
    let originalDocument: TestGlobals["document"];
    let originalMocha: TestGlobals["mocha"];

    before(async () => {
        const result = await esbuild.build({
            entryPoints: [path.resolve("src/runner/browser-env/vite/browser-modules/mocha/index.ts")],
            bundle: true,
            format: "cjs",
            platform: "browser",
            write: false,
        });
        const browserModule: { exports: Partial<{ MochaWrapper: MochaWrapperConstructor }> } = { exports: {} };
        new Function("module", "exports", result.outputFiles[0].text)(browserModule, browserModule.exports);
        ({ MochaWrapper } = browserModule.exports as { MochaWrapper: MochaWrapperConstructor });
    });

    beforeEach(() => {
        originalWindow = browserGlobals.window;
        originalDocument = browserGlobals.document;
        originalMocha = browserGlobals.mocha;
        browserGlobals.mocha = { suite: {} };
        browserGlobals.document = { querySelector: sandbox.stub().returns(null) };
        browserGlobals.window = {
            Mocha: {},
            __testplane__: {
                browser: {},
                errors: [],
                profilerLevel: 3,
                socket: {
                    on: sandbox.stub(),
                    emit: sandbox.stub(),
                },
            },
        };
    });

    afterEach(() => {
        sandbox.restore();
        browserGlobals.window = originalWindow;
        browserGlobals.document = originalDocument;
        browserGlobals.mocha = originalMocha;
    });

    it("should run and acknowledge the runnable when initial telemetry throws", async () => {
        sandbox.stub(performance, "getEntriesByType").throws(new Error("telemetry unavailable"));
        const { handler, runnable, callback } = prepareRunnable();

        await handler({ fullTitle: "suite test" }, callback);

        assert.calledOnce(runnable);
        assert.calledOnce(callback);
        assert.notCalled(browserGlobals.window!.__testplane__.socket.emit);
    });

    it("should acknowledge the runnable when telemetry delivery throws", async () => {
        sandbox.stub(performance, "getEntriesByType").returns([]);
        browserGlobals.window!.__testplane__.socket.emit.callsFake((event: string) => {
            if (event.endsWith(":profilerFragment")) {
                throw new Error("socket unavailable");
            }
        });
        const { handler, runnable, callback } = prepareRunnable();

        await handler({ fullTitle: "suite test" }, callback);

        assert.calledOnce(runnable);
        assert.calledOnce(callback);
    });

    function prepareRunnable(): { handler: RunRunnableHandler; runnable: SinonStub; callback: SinonStub } {
        const wrapper = MochaWrapper.create();
        wrapper._subscribeOnWorkerMessages();
        const handler = browserGlobals.window!.__testplane__.socket.on.firstCall.args[1] as RunRunnableHandler;
        const runnable = sandbox.stub().resolves();
        const callback = sandbox.stub();
        wrapper._runnables.set("suite test", { fn: runnable });

        return { handler, runnable, callback };
    }
});
