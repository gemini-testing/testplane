"use strict";

const { AsyncEmitter } = require("src/events/async-emitter");
const { BasicPool } = require("src/browser-pool/basic-pool");
const { NewBrowser } = require("src/browser/new-browser");
const { CancelledError } = require("src/browser-pool/cancelled-error");
const { LocalBrowserBackend } = require("src/browser-backend/local");
const { RemoteBrowserBackend } = require("src/browser-backend/remote");
const { SelenoidDockerController } = require("src/browser-backend/docker/controller");
const { MasterEvents: Events } = require("src/events");
const { stubBrowser } = require("./util");
const { createBrowserConfig_, mkSessionStub_ } = require("../browser/utils");
const { promiseDelay } = require("../../../src/utils/promise");

describe("browser-pool/basic-pool", () => {
    const sandbox = sinon.createSandbox();
    let pools;

    const mkBrowserConfig_ = (id = "broId", opts = {}) => createBrowserConfig_({ id, ...opts }).forBrowser();

    const mkPool_ = ({ runtimeOptions = {}, emitter = new AsyncEmitter(), observer } = {}) => {
        const pool = BasicPool.create(runtimeOptions, emitter, observer);
        pools.push(pool);

        return pool;
    };

    beforeEach(() => {
        pools = [];
        sandbox.stub(NewBrowser, "create").callsFake(async config => stubBrowser(config.id));
    });

    afterEach(async () => {
        try {
            await Promise.all(pools.map(pool => pool[Symbol.asyncDispose]()));
        } finally {
            sandbox.restore();
        }
    });

    describe("shared Docker backends", () => {
        let controller;
        const dockerConfig = id =>
            mkBrowserConfig_(id, {
                gridUrl: "docker",
                docker: { image: `${id}:1`, selenoidImage: "selenoid:1" },
            });

        beforeEach(() => {
            controller = {
                ensureBrowser: sandbox.stub().resolves(),
                [Symbol.asyncDispose]: sandbox.stub().resolves(),
            };
            sandbox.stub(SelenoidDockerController, "create").resolves(controller);
        });

        it("should prewarm all selected images and retain the shared controller between session batches", async () => {
            const pool = mkPool_();
            const configs = [dockerConfig("first"), dockerConfig("second")];

            await pool.prewarm(configs);
            const browsers = await Promise.all(configs.map(config => pool.getBrowser(config)));
            assert.calledOnceWith(SelenoidDockerController.create, configs);
            await Promise.all(browsers.map(browser => pool.freeBrowser(browser)));
            assert.notCalled(controller[Symbol.asyncDispose]);

            await pool.getBrowser(configs[0]);
            assert.calledOnce(SelenoidDockerController.create);
            await pool[Symbol.asyncDispose]();
            assert.calledOnce(controller[Symbol.asyncDispose]);
        });

        it("should share controller initialization between concurrent browser requests", async () => {
            const pool = mkPool_();
            const config = dockerConfig("chrome");

            await Promise.all([pool.getBrowser(config), pool.getBrowser(config)]);

            assert.calledOnce(SelenoidDockerController.create);
            assert.calledTwice(NewBrowser.create);
            assert.strictEqual(NewBrowser.create.firstCall.args[1], NewBrowser.create.secondCall.args[1]);
        });

        it("should prewarm additional images when the shared backend already exists", async () => {
            const preparedImages = new Set();
            SelenoidDockerController.create.callsFake(async configs => {
                configs.forEach(config => preparedImages.add(config.docker.image));
                return controller;
            });
            controller.ensureBrowser.callsFake(async config => {
                preparedImages.add(config.docker.image);
            });
            const pool = mkPool_();

            await pool.prewarm([dockerConfig("first")]);
            await pool.prewarm([dockerConfig("second")]);

            assert.calledOnce(SelenoidDockerController.create);
            assert.notCalled(NewBrowser.create);
            assert.sameMembers([...preparedImages], ["first:1", "second:1"]);
        });

        it("should share a startup failure and allow a later request to retry", async () => {
            const error = new Error("controller failed");
            SelenoidDockerController.create.onFirstCall().rejects(error);
            const pool = mkPool_();
            const config = dockerConfig("chrome");

            const results = await Promise.allSettled([pool.getBrowser(config), pool.getBrowser(config)]);

            assert.deepEqual(results, [
                { status: "rejected", reason: error },
                { status: "rejected", reason: error },
            ]);
            assert.calledOnce(SelenoidDockerController.create);
            assert.notCalled(NewBrowser.create);
            await pool.getBrowser(config);
            assert.calledTwice(SelenoidDockerController.create);
        });

        it("should prepare both selections when prewarm calls share pending initialization", async () => {
            let finish;
            SelenoidDockerController.create.returns(
                new Promise(resolve => {
                    finish = resolve;
                }),
            );
            const pool = mkPool_();
            const first = dockerConfig("first");
            const second = dockerConfig("second");
            const pending = Promise.all([pool.prewarm([first]), pool.prewarm([second])]);

            finish(controller);
            await pending;

            assert.calledOnce(SelenoidDockerController.create);
            assert.calledWith(controller.ensureBrowser, first);
            assert.calledWith(controller.ensureBrowser, second);
        });

        it("should propagate failures when prewarming an additional image", async () => {
            const pool = mkPool_();
            await pool.prewarm([dockerConfig("first")]);
            const error = new Error("image pull failed");
            controller.ensureBrowser.rejects(error);

            assert.strictEqual(await pool.prewarm([dockerConfig("second")]).catch(err => err), error);
            assert.calledOnce(SelenoidDockerController.create);
        });

        it("should wait for controller startup during disposal without creating a session", async () => {
            let finish;
            SelenoidDockerController.create.returns(
                new Promise(resolve => {
                    finish = resolve;
                }),
            );
            const pool = mkPool_();
            const pending = assert.isRejected(pool.getBrowser(dockerConfig("chrome")), CancelledError);
            const disposing = pool[Symbol.asyncDispose]();

            finish(controller);
            await pending;
            await disposing;

            assert.notCalled(NewBrowser.create);
            assert.calledOnce(controller[Symbol.asyncDispose]);
        });

        it("should close active sessions before disposing their shared controller", async () => {
            const pool = mkPool_();
            const browsers = await Promise.all([
                pool.getBrowser(dockerConfig("first")),
                pool.getBrowser(dockerConfig("second")),
            ]);

            await pool[Symbol.asyncDispose]();

            for (const browser of browsers) {
                assert.calledOnce(browser.quit);
                assert.callOrder(browser.quit, controller[Symbol.asyncDispose]);
            }
            assert.calledOnce(controller[Symbol.asyncDispose]);
        });

        it("should give separate pools independent backend ownership", async () => {
            const config = dockerConfig("chrome");
            await Promise.all([mkPool_().prewarm([config]), mkPool_().prewarm([config])]);

            assert.calledTwice(SelenoidDockerController.create);
        });
    });

    it("should create new browser when requested", async () => {
        const config = mkBrowserConfig_();

        await mkPool_().getBrowser(config);

        assert.calledWith(
            NewBrowser.create,
            config,
            sinon.match.instanceOf(RemoteBrowserBackend),
            sinon.match({ id: "broId" }),
        );
    });

    it("should create new browser with specified version when requested", async () => {
        await mkPool_().getBrowser(mkBrowserConfig_(), { version: "1.0" });

        assert.calledWith(
            NewBrowser.create,
            sinon.match.any,
            sinon.match.any,
            sinon.match({ id: "broId", version: "1.0" }),
        );
    });

    it("should pass the local backend when creating a local browser", async () => {
        await mkPool_().getBrowser(mkBrowserConfig_("broId", { gridUrl: "local" }));

        assert.calledWith(
            NewBrowser.create,
            sinon.match.any,
            sinon.match.instanceOf(LocalBrowserBackend),
            sinon.match({ id: "broId" }),
        );
    });

    it("should await browser creation before resetting it", async () => {
        const browser = stubBrowser();
        let finish;
        let started;
        const creating = new Promise(resolve => {
            started = resolve;
        });
        NewBrowser.create.callsFake(() => {
            started();

            return new Promise(resolve => {
                finish = resolve;
            });
        });
        const pending = mkPool_().getBrowser(mkBrowserConfig_());
        await creating;

        assert.notCalled(browser.reset);
        finish(browser);
        assert.strictEqual(await pending, browser);
        assert.calledOnce(browser.reset);
    });

    it("should not finalize browser if failed to start it", async () => {
        const publicAPI = null;
        const browser = stubBrowser("some-id", "some-version", publicAPI);
        NewBrowser.create.rejects(new Error("foo"));

        const pool = mkPool_();

        await assert.isRejected(pool.getBrowser(mkBrowserConfig_()), "foo");

        assert.notCalled(browser.quit);
    });

    it("should fail the profiler operation if browser creation throws", async () => {
        const error = new Error("factory failed");
        const operation = { end: sandbox.stub() };
        const observer = { start: sandbox.stub().returns(operation), record: sandbox.stub() };
        const config = mkBrowserConfig_();
        const pool = mkPool_({ observer });
        NewBrowser.create.rejects(error);

        await assert.isRejected(pool.getBrowser(config), error.message);

        assert.calledOnceWith(operation.end, "failed");
    });

    it("should fail the profiler operation and release the browser if reset fails", async () => {
        const browser = stubBrowser();
        browser.reset.rejects(new Error("reset failed"));
        NewBrowser.create.resolves(browser);
        const operation = { end: sandbox.stub() };
        const observer = { start: sandbox.stub().returns(operation), record: sandbox.stub() };

        await assert.isRejected(mkPool_({ observer }).getBrowser(mkBrowserConfig_()), "reset failed");

        assert.calledOnce(browser.quit);
        assert.calledOnceWith(operation.end, "failed");
    });

    it("should complete the profiler operation once when browser creation succeeds", async () => {
        const operation = { end: sandbox.stub() };
        const observer = { start: sandbox.stub().returns(operation), record: sandbox.stub() };

        await mkPool_({ observer }).getBrowser(mkBrowserConfig_());

        assert.calledOnceWithExactly(operation.end);
    });

    it("should finalize browser if failed after start it", async () => {
        const publicAPI = {};
        const browser = stubBrowser("some-id", "some-version", publicAPI);
        NewBrowser.create.returns(browser);

        const emitter = new AsyncEmitter().on(Events.SESSION_START, () => Promise.reject(new Error("foo")));

        const pool = mkPool_({ emitter });

        await assert.isRejected(pool.getBrowser(mkBrowserConfig_()), "foo");

        assert.calledOnce(browser.quit);
    });

    describe("SESSION_START event", () => {
        it("should be emitted after browser creation", async () => {
            const browser = stubBrowser();
            NewBrowser.create.returns(browser);

            const onSessionStart = sandbox.stub().named("onSessionStart");
            const emitter = new AsyncEmitter().on(Events.SESSION_START, onSessionStart);

            await mkPool_({ emitter }).getBrowser(mkBrowserConfig_());

            assert.callOrder(NewBrowser.create, onSessionStart);
        });

        it("handler should be waited by pool", async () => {
            const browser = stubBrowser();
            NewBrowser.create.returns(browser);

            const afterSessionStart = sandbox.stub().named("afterSessionStart");
            const emitter = new AsyncEmitter().on(Events.SESSION_START, () => promiseDelay(1).then(afterSessionStart));

            await mkPool_({ emitter }).getBrowser(mkBrowserConfig_());

            assert.callOrder(afterSessionStart, browser.reset);
        });

        it("handler fail should fail browser request", async () => {
            const emitter = new AsyncEmitter().on(Events.SESSION_START, () => Promise.reject(new Error("foo")));

            const pool = mkPool_({ emitter });

            await assert.isRejected(pool.getBrowser(mkBrowserConfig_()), "foo");
        });

        it("on handler fail browser should be finalized", async () => {
            const browser = stubBrowser();
            NewBrowser.create.returns(browser);

            const emitter = new AsyncEmitter().on(Events.SESSION_START, () => Promise.reject(new Error()));

            const pool = mkPool_({ emitter });

            await assert.isRejected(pool.getBrowser(mkBrowserConfig_()));

            assert.calledOnce(browser.quit);
        });
    });

    it("should quit a browser when freed", async () => {
        const pool = mkPool_();
        const browser = await pool.getBrowser(mkBrowserConfig_());

        await pool.freeBrowser(browser);

        assert.calledOnce(browser.quit);
    });

    describe("SESSION_END event", () => {
        it("should be emitted before browser quit", async () => {
            const onSessionEnd = sandbox.stub().named("onSessionEnd");
            const emitter = new AsyncEmitter().on(Events.SESSION_END, onSessionEnd);

            const pool = mkPool_({ emitter });
            const browser = await pool.getBrowser(mkBrowserConfig_());

            await pool.freeBrowser(browser);

            assert.callOrder(onSessionEnd, browser.quit);
        });

        it("handler should be waited before actual quit", async () => {
            const afterSessionEnd = sandbox.stub().named("afterSessionEnd");
            const emitter = new AsyncEmitter().on(Events.SESSION_END, () => promiseDelay(1).then(afterSessionEnd));

            const pool = mkPool_({ emitter });
            const browser = await pool.getBrowser(mkBrowserConfig_());

            await pool.freeBrowser(browser);

            assert.callOrder(afterSessionEnd, browser.quit);
        });

        it("handler fail should not prevent browser from quit", async () => {
            const emitter = new AsyncEmitter().on(Events.SESSION_END, () => Promise.reject(new Error()));

            const pool = mkPool_({ emitter });
            const browser = await pool.getBrowser(mkBrowserConfig_());

            await pool.freeBrowser(browser);

            assert.calledOnce(browser.quit);
        });
    });

    describe("cancel", () => {
        it("should quit all browsers on cancel", async () => {
            const pool = mkPool_();

            const [bro1, bro2] = await Promise.all([
                pool.getBrowser(mkBrowserConfig_("bro1")),
                pool.getBrowser(mkBrowserConfig_("bro2")),
            ]);

            pool.cancel();
            await Promise.all([pool.freeBrowser(bro1), pool.freeBrowser(bro2)]);

            assert.calledOnce(bro1.quit);
            assert.calledOnce(bro2.quit);
        });

        it("should release a real browser after its cancel cleanup completes", async () => {
            const emitter = new AsyncEmitter();
            const config = mkBrowserConfig_();
            const session = mkSessionStub_();
            sandbox.stub(RemoteBrowserBackend.prototype, "startSession").resolves(session);
            sandbox.stub(RemoteBrowserBackend.prototype, "deleteSession").callsFake(() => session.deleteSession());
            NewBrowser.create.callThrough();
            const pool = mkPool_({ emitter });

            const browser = await pool.getBrowser(config);

            pool.cancel();

            await assert.isFulfilled(pool.freeBrowser(browser));
            assert.equal(browser.sessionId, session.sessionId);
            assert.calledOnce(session.deleteSession);
        });

        it("should quit all browser with the same id on cancel", async () => {
            const pool = mkPool_();

            const config = mkBrowserConfig_();
            const [bro1, bro2] = await Promise.all([pool.getBrowser(config), pool.getBrowser(config)]);

            pool.cancel();
            await Promise.all([pool.freeBrowser(bro1), pool.freeBrowser(bro2)]);

            assert.calledOnce(bro1.quit);
            assert.calledOnce(bro2.quit);
        });

        it("should reject all subsequent reqests for browser", async () => {
            const pool = mkPool_();

            pool.cancel();

            await assert.isRejected(pool.getBrowser(mkBrowserConfig_()), CancelledError);
        });

        it("should reject subsequent browser requests with passed cancel error", async () => {
            const error = new Error("Tests were stopped by the user");
            const pool = mkPool_();

            pool.cancel(error);

            await assert.isRejected(pool.getBrowser(mkBrowserConfig_()), error);
            assert.notCalled(NewBrowser.create);
        });

        it("should quit browser once if it was launched after cancel", async () => {
            const browser = stubBrowser();
            NewBrowser.create.returns(browser);

            const emitter = new AsyncEmitter();
            const pool = mkPool_({ emitter });

            emitter.on(Events.SESSION_START, () => pool.cancel());

            await assert.isRejected(pool.getBrowser(mkBrowserConfig_()));

            assert.calledOnce(browser.quit);
        });

        it("should quit browsers only once", async () => {
            const pool = mkPool_();

            const browser = await pool.getBrowser(mkBrowserConfig_());

            pool.cancel();
            pool.cancel();
            await pool.freeBrowser(browser);

            assert.calledOnce(browser.quit);
        });
    });
});
