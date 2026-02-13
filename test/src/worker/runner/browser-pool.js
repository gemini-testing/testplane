"use strict";

const EventEmitter = require("events").EventEmitter;
const _ = require("lodash");
const { ExistingBrowser } = require("src/browser/existing-browser");
const BrowserPool = require("src/worker/runner/browser-pool");
const { Calibrator } = require("src/browser/calibrator");
const { WorkerEvents: RunnerEvents } = require("src/events");
const ipc = require("src/utils/ipc");

describe("worker/browser-pool", () => {
    const sandbox = sinon.createSandbox();

    const stubConfig = browserConfig => {
        return {
            forBrowser: () => browserConfig || {},
        };
    };

    const createPool = opts => {
        opts = _.defaults(opts || {}, {
            config: stubConfig(),
            emitter: new EventEmitter(),
        });

        return BrowserPool.create(opts.config, opts.emitter);
    };

    const stubBrowser = opts => {
        const bro = _.defaults(opts || {}, {
            state: { isBroken: false },
        });

        bro.init = sandbox.stub().resolves();
        bro.quit = sandbox.stub();
        bro.markAsBroken = sandbox.stub();

        return bro;
    };

    beforeEach(() => {
        sandbox.stub(ExistingBrowser, "create");
        sandbox.stub(ipc, "emit");
    });

    afterEach(() => sandbox.restore());

    describe("getBrowser", () => {
        it("should create browser with correct args", async () => {
            const config = stubConfig();
            const emitter = new EventEmitter();
            const browserPool = createPool({ config, emitter });
            ExistingBrowser.create.returns(stubBrowser({ browserId: "bro-id" }));

            await browserPool.getBrowser({ browserId: "bro-id", browserVersion: "1.0", state: {} });

            assert.calledOnceWith(ExistingBrowser.create, config, {
                id: "bro-id",
                version: "1.0",
                state: {},
                emitter,
            });
        });

        it("should init a new created browser ", async () => {
            const browser = stubBrowser({ browserId: "bro-id" });
            ExistingBrowser.create.returns(browser);

            await createPool().getBrowser({
                browserId: "bro-id",
                sessionId: "100-500",
                sessionCaps: "some-caps",
                sessionOpts: "some-opts",
            });

            assert.calledOnceWith(
                browser.init,
                { sessionId: "100-500", sessionCaps: "some-caps", sessionOpts: "some-opts" },
                sinon.match.instanceOf(Calibrator),
            );
        });

        it('should emit "NEW_BROWSER" event on creating of a browser', async () => {
            const emitter = new EventEmitter();
            const onNewBrowser = sandbox.spy().named("onNewBrowser");
            const browserPool = createPool({ emitter });

            emitter.on(RunnerEvents.NEW_BROWSER, onNewBrowser);

            ExistingBrowser.create.returns(stubBrowser({ id: "bro-id", publicAPI: { some: "api" } }));

            await browserPool.getBrowser({ browserId: "bro-id", browserVersion: "10.1" });

            assert.calledOnceWith(onNewBrowser, { some: "api" }, { browserId: "bro-id", browserVersion: "10.1" });
        });

        it("should return a new created browser", () => {
            const config = stubConfig();
            const browserPool = createPool({ config });
            const browser = stubBrowser({ browserId: "bro-id" });
            ExistingBrowser.create.returns(browser);

            return assert.becomes(browserPool.getBrowser({ browserId: "bro-id" }), browser);
        });

        describe("getting of browser fails", () => {
            beforeEach(() => {
                sandbox.spy(BrowserPool.prototype, "freeBrowser");
            });

            it("should be rejected if instance of browser was not created", () => {
                ExistingBrowser.create.throws(new Error("foo bar"));

                return assert.isRejected(createPool().getBrowser({}), /foo bar/);
            });

            describe("init fails", () => {
                const stubBrowserWhichRejectsOnInit = (params = {}) => {
                    const browser = stubBrowser(params);
                    ExistingBrowser.create.returns(browser);

                    browser.init.rejects();

                    return browser;
                };

                it("should mark browser as broken", async () => {
                    const browser = stubBrowserWhichRejectsOnInit({ id: "bro-id" });

                    await createPool()
                        .getBrowser({ browserId: "bro-id" })
                        .catch(e => e);

                    assert.calledOnceWith(browser.markAsBroken, { stubBrowserCommands: true });
                });

                it("should free browser", async () => {
                    const browser = stubBrowserWhichRejectsOnInit({ id: "bro-id" });

                    await createPool()
                        .getBrowser({ browserId: "bro-id" })
                        .catch(e => e);

                    assert.calledOnceWith(BrowserPool.prototype.freeBrowser, browser);
                });

                it("should free browser after marking browser as broken", async () => {
                    const browser = stubBrowserWhichRejectsOnInit({ id: "bro-id" });

                    await createPool()
                        .getBrowser({ browserId: "bro-id" })
                        .catch(e => e);

                    assert.callOrder(browser.markAsBroken, BrowserPool.prototype.freeBrowser);
                });

                it("should be rejected with error extended by browser meta", async () => {
                    stubBrowserWhichRejectsOnInit({ id: "bro-id", meta: { foo: "bar" } });

                    const error = await createPool()
                        .getBrowser({ browserId: "bro-id" })
                        .catch(e => e);

                    assert.deepEqual(error.meta, { foo: "bar" });
                });
            });
        });
    });

    describe("freeBrowser", () => {
        it("should send test related freeBrowser event on browser release", async () => {
            await createPool().freeBrowser(stubBrowser({ sessionId: "100500", state: { foo: "bar" } }));

            assert.calledOnceWith(ipc.emit, "worker.100500.freeBrowser", { foo: "bar" });
        });

        it("should quit from browser", async () => {
            const browserPool = createPool();
            ExistingBrowser.create.returns(stubBrowser());

            const browser = await browserPool.getBrowser({ browserId: "bro-id" });
            browserPool.freeBrowser(browser);

            assert.calledOnce(browser.quit);
        });
    });
});
