"use strict";

const { BasicPool } = require("src/browser-pool/basic-pool");
const { LimitedPool } = require("src/browser-pool/limited-pool");
const { PerBrowserLimitedPool } = require("src/browser-pool/per-browser-limited-pool");
const pool = require("src/browser-pool");
const _ = require("lodash");
const { EventEmitter } = require("events");
const { makeConfigStub } = require("../../utils");

describe("browser-pool", () => {
    const sandbox = sinon.createSandbox();
    let basicPool;

    beforeEach(() => {
        basicPool = sinon.createStubInstance(BasicPool);
        sandbox.stub(BasicPool, "create").returns(basicPool);
    });

    afterEach(() => sandbox.restore());

    const mkPool_ = opts => {
        opts = _.defaults(opts, {
            emitter: new EventEmitter(),
            config: makeConfigStub(),
        });

        return pool.create(opts.config, opts.emitter);
    };

    it("should create basic pool", () => {
        const emitter = new EventEmitter();
        const config = makeConfigStub();

        pool.create(config, emitter);

        assert.calledOnce(BasicPool.create);
        assert.calledWith(
            BasicPool.create,
            { browserDownloadMirrors: config.browserDownloadMirrors, areLocalWdDebugLogsEnabled: config.system.debug },
            emitter,
        );
    });

    it("should create pool according to perBrowserLimit by default", () => {
        const browserPool = mkPool_();

        assert.instanceOf(browserPool, PerBrowserLimitedPool);
    });

    it("should create pool according to parallelLimit if that option exist", () => {
        const config = makeConfigStub({ system: { parallelLimit: 10 } });

        const browserPool = mkPool_({ config });

        assert.instanceOf(browserPool, LimitedPool);
    });

    it("should ignore parallelLimit if its value is Infinity", () => {
        const config = makeConfigStub({ system: { parallelLimit: Infinity } });

        const browserPool = mkPool_({ config });

        assert.instanceOf(browserPool, PerBrowserLimitedPool);
    });

    it("should ignore parallelLimit if its value is not set", () => {
        const config = makeConfigStub({ system: {} });

        const browserPool = mkPool_({ config });

        assert.instanceOf(browserPool, PerBrowserLimitedPool);
    });

    describe("with a finite parallelLimit", () => {
        beforeEach(() => {
            basicPool.getBrowser.callsFake(async (config, { version } = {}) => ({
                id: config.id,
                config,
                version,
                reset: sandbox.stub().resolves(),
            }));
            basicPool.freeBrowser.resolves();
        });

        const setup = limit => {
            const config = makeConfigStub({
                browsers: ["chrome", "firefox"],
                sessionsPerBrowser: limit,
                system: { parallelLimit: limit },
            });
            return {
                browserPool: mkPool_({ config }),
                chrome: config.forBrowser("chrome"),
                firefox: config.forBrowser("firefox"),
            };
        };

        it("should reuse a session when the next request waits in the global queue", async () => {
            const { browserPool, chrome } = setup(2);
            chrome.testsPerSession = 2;
            const [first, second] = await Promise.all([browserPool.getBrowser(chrome), browserPool.getBrowser(chrome)]);
            const queued = browserPool.getBrowser(chrome);

            await browserPool.freeBrowser(first);

            assert.strictEqual(await queued, first);
            assert.callCount(basicPool.getBrowser, 2);
            assert.notCalled(basicPool.freeBrowser);

            const next = browserPool.getBrowser(chrome);
            await browserPool.freeBrowser(first);

            const replacement = await next;
            assert.notStrictEqual(replacement, first);
            assert.calledOnceWithExactly(basicPool.freeBrowser, first);
            await Promise.all([browserPool.freeBrowser(replacement), browserPool.freeBrowser(second)]);
        });

        it("should close the other session when simultaneous releases have only one matching request", async () => {
            const { browserPool, chrome, firefox } = setup(2);
            const [first, second] = await Promise.all([browserPool.getBrowser(chrome), browserPool.getBrowser(chrome)]);
            const matching = browserPool.getBrowser(chrome);
            const different = browserPool.getBrowser(firefox);
            const closing = Promise.withResolvers();
            basicPool.freeBrowser.returns(closing.promise);

            const released = Promise.all([browserPool.freeBrowser(first), browserPool.freeBrowser(second)]);
            await new Promise(resolve => setImmediate(resolve));

            assert.calledOnce(basicPool.freeBrowser);
            assert.callCount(basicPool.getBrowser, 2);
            closing.resolve();

            await released;
            assert.include([first, second], await matching);
            assert.strictEqual((await different).id, "firefox");
            assert.callCount(basicPool.getBrowser, 3);
        });

        it("should give a high-priority request the slot even if it queues during a matching release", async () => {
            const { browserPool, chrome } = setup(1);
            const first = await browserPool.getBrowser(chrome, { version: "1" });
            const matching = browserPool.getBrowser(chrome, { version: "1" });
            const closing = Promise.withResolvers();
            basicPool.freeBrowser.onFirstCall().returns(closing.promise);

            const released = browserPool.freeBrowser(first);
            const highPriority = browserPool.getBrowser(chrome, { version: "2", highPriority: true });
            await new Promise(resolve => setImmediate(resolve));

            assert.calledOnceWithExactly(basicPool.freeBrowser, first);
            assert.calledOnce(basicPool.getBrowser);
            closing.resolve();

            await released;
            const second = await highPriority;
            assert.strictEqual(second.version, "2");
            await browserPool.freeBrowser(second);
            assert.strictEqual((await matching).version, "1");
        });
    });
});
