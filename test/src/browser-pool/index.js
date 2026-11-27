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

    beforeEach(() => {
        sandbox.stub(BasicPool, "create").returns(sinon.createStubInstance(BasicPool));
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
        let basicPool;
        let config;
        let browserPool;

        beforeEach(() => {
            basicPool = sinon.createStubInstance(BasicPool);
            BasicPool.create.returns(basicPool);
            basicPool.getBrowser.callsFake(async (config, { version } = {}) => ({
                id: config.id,
                config,
                version,
                reset: sandbox.stub().resolves(),
            }));
            basicPool.freeBrowser.resolves();
            config = makeConfigStub({
                browsers: ["chrome", "firefox"],
                system: { parallelLimit: 2 },
                sessionsPerBrowser: 2,
            });
            browserPool = mkPool_({ config });
        });

        it("should reuse a session for a request waiting in the global queue", async () => {
            const chrome = config.forBrowser("chrome");
            const [first, second] = await Promise.all([browserPool.getBrowser(chrome), browserPool.getBrowser(chrome)]);
            const queued = browserPool.getBrowser(chrome);

            await browserPool.freeBrowser(first);

            assert.strictEqual(await queued, first);
            assert.callCount(basicPool.getBrowser, 2);
            assert.notCalled(basicPool.freeBrowser);
            await Promise.all([browserPool.freeBrowser(first), browserPool.freeBrowser(second)]);
        });

        it("should wait for cached sessions to close before opening replacements for another profile", async () => {
            const chrome = config.forBrowser("chrome");
            const firefox = config.forBrowser("firefox");
            const browsers = await Promise.all([browserPool.getBrowser(chrome), browserPool.getBrowser(chrome)]);
            await Promise.all(browsers.map(browser => browserPool.freeBrowser(browser)));
            assert.notCalled(basicPool.freeBrowser);

            const closing = Promise.withResolvers();
            basicPool.freeBrowser.returns(closing.promise);
            const replacements = Promise.all([browserPool.getBrowser(firefox), browserPool.getBrowser(firefox)]);

            await new Promise(resolve => setImmediate(resolve));

            assert.callCount(basicPool.getBrowser, 2);
            assert.callCount(basicPool.freeBrowser, 2);
            closing.resolve();
            await replacements;
            assert.callCount(basicPool.getBrowser, 4);
        });

        it("should reuse an idle session and evict an incompatible version at the profile limit", async () => {
            const chrome = config.forBrowser("chrome");
            chrome.sessionsPerBrowser = 1;
            browserPool = mkPool_({ config });
            const first = await browserPool.getBrowser(chrome, { version: "1" });
            await browserPool.freeBrowser(first);

            assert.notCalled(basicPool.freeBrowser);
            assert.strictEqual(await browserPool.getBrowser(chrome, { version: "1" }), first);
            await browserPool.freeBrowser(first);
            const replacement = await browserPool.getBrowser(chrome, { version: "2" });

            assert.notStrictEqual(replacement, first);
            assert.calledOnceWithExactly(basicPool.freeBrowser, first);
            assert.isTrue(basicPool.freeBrowser.firstCall.calledBefore(basicPool.getBrowser.secondCall));
        });

        it("should keep the slot occupied if an idle session fails to close", async () => {
            config.system.parallelLimit = 1;
            browserPool = mkPool_({ config });
            const chrome = config.forBrowser("chrome");
            const firefox = config.forBrowser("firefox");
            const first = await browserPool.getBrowser(chrome);
            await browserPool.freeBrowser(first);
            basicPool.freeBrowser.rejects(new Error("quit failed"));

            await assert.isRejected(browserPool.getBrowser(firefox), "quit failed");
            await assert.isRejected(browserPool.getBrowser(firefox), "quit failed");
            assert.calledOnce(basicPool.getBrowser);
        });

        it("should wait for a closing session to free a slot in its profile", async () => {
            const chrome = config.forBrowser("chrome");
            chrome.sessionsPerBrowser = 1;
            const firefox = config.forBrowser("firefox");
            browserPool = mkPool_({ config });

            const chromeSession = await browserPool.getBrowser(chrome);
            await browserPool.freeBrowser(chromeSession);
            const firefoxSession = await browserPool.getBrowser(firefox, { version: "1" });

            const closing = Promise.withResolvers();
            basicPool.freeBrowser.withArgs(chromeSession).returns(closing.promise);
            const newFirefox = browserPool.getBrowser(firefox, { version: "2" });
            const newChrome = browserPool.getBrowser(chrome);
            await browserPool.freeBrowser(firefoxSession);

            assert.calledOnceWithExactly(basicPool.freeBrowser, chromeSession);
            assert.callCount(basicPool.getBrowser, 2);

            closing.resolve();
            await Promise.all([newFirefox, newChrome]);
            assert.callCount(basicPool.getBrowser, 4);
        });

        it("should replace a session when it reaches testsPerSession", async () => {
            config.system.parallelLimit = 1;
            const chrome = config.forBrowser("chrome");
            chrome.testsPerSession = 1;
            browserPool = mkPool_({ config });
            const first = await browserPool.getBrowser(chrome);
            const queued = browserPool.getBrowser(chrome);

            await browserPool.freeBrowser(first);

            assert.notStrictEqual(await queued, first);
            assert.calledOnceWithExactly(basicPool.freeBrowser, first);
            assert.callCount(basicPool.getBrowser, 2);
        });
    });
});
