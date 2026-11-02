import proxyquire from "proxyquire";
import sinon from "sinon";
import { AsyncEmitter, MasterEvents } from "src/events";
import type { acquireStandalonePool as AcquireStandalonePool } from "src/browser/standalone/pool";

describe("browser/standalone/pool", () => {
    const sandbox = sinon.createSandbox();
    let acquire: typeof AcquireStandalonePool;
    let create: sinon.SinonStub;
    let dispose: sinon.SinonStub;
    let signals: AsyncEmitter;
    let leases: Awaited<ReturnType<typeof acquire>>[];
    const options = {
        areLocalWdDebugLogsEnabled: false,
        browserDownloadMirrors: { chrome: null, chromium: null, firefox: null, geckodriver: null },
    };

    beforeEach(() => {
        leases = [];
        signals = new AsyncEmitter();
        dispose = sandbox.stub().resolves();
        create = sandbox.stub().callsFake(() => {
            signals.on(MasterEvents.EXIT, () => dispose());

            return { [Symbol.asyncDispose]: dispose };
        });
        ({ acquireStandalonePool: acquire } = proxyquire("src/browser/standalone/pool", {
            "../../browser-pool/basic-pool": { BasicPool: { create } },
            "../../signal-handler": { __esModule: true, default: signals },
        }));
    });

    const getLease = async (runtimeOptions = options): Promise<Awaited<ReturnType<typeof acquire>>> => {
        const lease = await acquire(runtimeOptions);
        leases.push(lease);

        return lease;
    };

    afterEach(async () => {
        try {
            await Promise.allSettled(leases.map(lease => lease[Symbol.asyncDispose]()));
        } finally {
            sandbox.restore();
        }
    });

    it("should share one pool between concurrent launches and dispose only after the last release", async () => {
        const [first, second] = await Promise.all([getLease(), getLease()]);

        assert.calledOnce(create);
        assert.strictEqual(first.pool, second.pool);
        await first[Symbol.asyncDispose]();
        assert.notCalled(dispose);
        await second[Symbol.asyncDispose]();
        assert.calledOnce(dispose);

        const next = await getLease();
        assert.calledTwice(create);
        assert.notStrictEqual(next.pool, first.pool);
    });

    it("should count a pending launch before another session releases its lease", async () => {
        const first = await getLease();
        const pending = getLease();

        await first[Symbol.asyncDispose]();
        assert.notCalled(dispose);
        const second = await pending;
        await second[Symbol.asyncDispose]();
        assert.calledOnce(dispose);
    });

    it("should await the same cleanup for concurrent releases of the last lease", async () => {
        let finish!: () => void;
        dispose.returns(
            new Promise<void>(resolve => {
                finish = resolve;
            }),
        );
        const lease = await getLease();
        const first = lease[Symbol.asyncDispose]();
        const second = lease[Symbol.asyncDispose]();

        assert.strictEqual(first, second);
        assert.calledOnce(dispose);
        finish();
        await Promise.all([first, second]);
    });

    it("should keep existing sessions when another launch uses incompatible runtime options", async () => {
        const first = await getLease();

        await assert.isRejected(acquire({ ...options, areLocalWdDebugLogsEnabled: true }), "same download mirrors");
        assert.notCalled(dispose);
        await first[Symbol.asyncDispose]();
        assert.calledOnce(dispose);
    });

    it("should accept equivalent runtime options", async () => {
        const [first, second] = await Promise.all([
            getLease(),
            getLease({ ...options, browserDownloadMirrors: { ...options.browserDownloadMirrors } }),
        ]);

        assert.strictEqual(first.pool, second.pool);
        assert.calledOnce(create);
    });

    it("should start a new pool after disposal fails", async () => {
        dispose.onFirstCall().rejects(new Error("cleanup failed"));
        const first = await getLease();

        await assert.isRejected(first[Symbol.asyncDispose](), "cleanup failed");
        await getLease();

        assert.calledTwice(create);
    });

    it("should await in-flight cleanup before starting a new pool, even when cleanup fails", async () => {
        let reject!: (error: Error) => void;
        dispose.onFirstCall().returns(
            new Promise<void>((_resolve, fail) => {
                reject = fail;
            }),
        );
        const first = await getLease();
        const closed = assert.isRejected(first[Symbol.asyncDispose](), "cleanup failed");
        const pending = getLease();

        await Promise.resolve();
        assert.calledOnce(create);
        reject(new Error("cleanup failed"));
        await closed;
        const next = await pending;

        assert.calledTwice(create);
        assert.notStrictEqual(next.pool, first.pool);
    });

    it("should detach only the new pool's exit handler and leave sessions to explicit disposal", async () => {
        const existingHandler = sandbox.spy();
        signals.on(MasterEvents.EXIT, existingHandler);
        await getLease();

        await signals.emitAndWait(MasterEvents.EXIT);

        assert.calledOnce(existingHandler);
        assert.notCalled(dispose);
        assert.deepEqual(signals.listeners(MasterEvents.EXIT), [existingHandler]);
    });
});
