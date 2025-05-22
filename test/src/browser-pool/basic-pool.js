"use strict";

const _ = require("lodash");
const { AsyncEmitter } = require("src/events/async-emitter");
const { BasicPool } = require("src/browser-pool/basic-pool");
const { NewBrowser } = require("src/browser/new-browser");
const { CancelledError } = require("src/browser-pool/cancelled-error");
const { WebdriverPool } = require("src/browser-pool/webdriver-pool");
const { MasterEvents: Events } = require("src/events");
const { stubBrowser } = require("./util");
const { makeConfigStub } = require("../../utils");
const { promiseDelay } = require("../../../src/utils/promise");

describe("browser-pool/basic-pool", () => {
    const sandbox = sinon.createSandbox();

    const mkPool_ = opts => {
        opts = _.defaults(opts, {
            config: makeConfigStub(),
            emitter: new AsyncEmitter(),
        });

        return BasicPool.create(opts.config, opts.emitter);
    };

    beforeEach(() => {
        sandbox.stub(NewBrowser, "create").returns(stubBrowser());
    });

    afterEach(() => sandbox.restore());

    it("should create new browser when requested", async () => {
        const config = makeConfigStub();

        await mkPool_({ config }).getBrowser("broId");

        assert.calledWith(NewBrowser.create, config, sinon.match({ id: "broId" }));
    });

    it("should create new browser with specified version when requested", async () => {
        await mkPool_().getBrowser("broId", { version: "1.0" });

        assert.calledWith(NewBrowser.create, sinon.match.any, sinon.match({ id: "broId", version: "1.0" }));
    });

    it("should pass webdriver pool when creating new browser", async () => {
        await mkPool_().getBrowser("broId");

        assert.calledWith(
            NewBrowser.create,
            sinon.match.any,
            sinon.match({
                wdPool: sinon.match.instanceOf(WebdriverPool),
            }),
        );
    });

    it("should init browser", async () => {
        const browser = stubBrowser();
        NewBrowser.create.returns(browser);

        await mkPool_().getBrowser();

        assert.calledOnce(browser.init);
    });

    it("should not finalize browser if failed to start it", async () => {
        const publicAPI = null;
        const browser = stubBrowser("some-id", "some-version", publicAPI);
        browser.init.rejects(new Error("foo"));
        NewBrowser.create.returns(browser);

        const pool = mkPool_();

        await assert.isRejected(pool.getBrowser(), "foo");

        assert.notCalled(browser.quit);
    });

    it("should finalize browser if failed after start it", async () => {
        const publicAPI = {};
        const browser = stubBrowser("some-id", "some-version", publicAPI);
        browser.init.resolves();
        NewBrowser.create.returns(browser);

        const emitter = new AsyncEmitter().on(Events.SESSION_START, () => Promise.reject(new Error("foo")));

        const pool = mkPool_({ emitter });

        await assert.isRejected(pool.getBrowser(), "foo");

        assert.calledOnce(browser.quit);
    });

    describe("SESSION_START event", () => {
        it("should be emitted after browser init", async () => {
            const browser = stubBrowser();
            NewBrowser.create.returns(browser);

            const onSessionStart = sandbox.stub().named("onSessionStart");
            const emitter = new AsyncEmitter().on(Events.SESSION_START, onSessionStart);

            await mkPool_({ emitter }).getBrowser();

            assert.callOrder(browser.init, onSessionStart);
        });

        it("handler should be waited by pool", async () => {
            const browser = stubBrowser();
            NewBrowser.create.returns(browser);

            const afterSessionStart = sandbox.stub().named("afterSessionStart");
            const emitter = new AsyncEmitter().on(Events.SESSION_START, () => promiseDelay(1).then(afterSessionStart));

            await mkPool_({ emitter }).getBrowser();

            assert.callOrder(afterSessionStart, browser.reset);
        });

        it("handler fail should fail browser request", async () => {
            const emitter = new AsyncEmitter().on(Events.SESSION_START, () => Promise.reject(new Error("foo")));

            const pool = mkPool_({ emitter });

            await assert.isRejected(pool.getBrowser(), "foo");
        });

        it("on handler fail browser should be finalized", async () => {
            const browser = stubBrowser();
            NewBrowser.create.returns(browser);

            const emitter = new AsyncEmitter().on(Events.SESSION_START, () => Promise.reject(new Error()));

            const pool = mkPool_({ emitter });

            await assert.isRejected(pool.getBrowser());

            assert.calledOnce(browser.quit);
        });
    });

    it("should quit a browser when freed", async () => {
        const pool = mkPool_();
        const browser = await pool.getBrowser();

        await pool.freeBrowser(browser);

        assert.calledOnce(browser.quit);
    });

    describe("SESSION_END event", () => {
        it("should be emitted before browser quit", async () => {
            const onSessionEnd = sandbox.stub().named("onSessionEnd");
            const emitter = new AsyncEmitter().on(Events.SESSION_END, onSessionEnd);

            const pool = mkPool_({ emitter });
            const browser = await pool.getBrowser();

            await pool.freeBrowser(browser);

            assert.callOrder(onSessionEnd, browser.quit);
        });

        it("handler should be waited before actual quit", async () => {
            const afterSessionEnd = sandbox.stub().named("afterSessionEnd");
            const emitter = new AsyncEmitter().on(Events.SESSION_END, () => promiseDelay(1).then(afterSessionEnd));

            const pool = mkPool_({ emitter });
            const browser = await pool.getBrowser();

            await pool.freeBrowser(browser);

            assert.callOrder(afterSessionEnd, browser.quit);
        });

        it("handler fail should not prevent browser from quit", async () => {
            const emitter = new AsyncEmitter().on(Events.SESSION_END, () => Promise.reject(new Error()));

            const pool = mkPool_({ emitter });
            const browser = await pool.getBrowser();

            await pool.freeBrowser(browser);

            assert.calledOnce(browser.quit);
        });
    });

    describe("cancel", () => {
        it("should quit all browsers on cancel", async () => {
            const pool = mkPool_();

            const [bro1, bro2] = await Promise.all([pool.getBrowser("bro1"), pool.getBrowser("bro2")]);

            pool.cancel();

            assert.calledOnce(bro1.quit);
            assert.calledOnce(bro2.quit);
        });

        it("should quit all browser with the same id on cancel", async () => {
            const pool = mkPool_();

            const [bro1, bro2] = await Promise.all([pool.getBrowser("bro"), pool.getBrowser("bro")]);

            pool.cancel();

            assert.calledOnce(bro1.quit);
            assert.calledOnce(bro2.quit);
        });

        it("should reject all subsequent reqests for browser", async () => {
            const pool = mkPool_();

            pool.cancel();

            await assert.isRejected(pool.getBrowser(), CancelledError);
        });

        it("should quit browser once if it was launched after cancel", async () => {
            const browser = stubBrowser();
            NewBrowser.create.returns(browser);

            const emitter = new AsyncEmitter();
            const pool = mkPool_({ emitter });

            emitter.on(Events.SESSION_START, () => pool.cancel());

            await assert.isRejected(pool.getBrowser());

            assert.calledOnce(browser.quit);
        });

        it("should quit browsers only once", async () => {
            const pool = mkPool_();

            const browser = await pool.getBrowser();

            pool.cancel();
            pool.cancel();

            assert.calledOnce(browser.quit);
        });
    });
});
