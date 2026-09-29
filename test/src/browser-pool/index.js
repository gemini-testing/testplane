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

        sandbox.spy(BasicPool, "create");

        pool.create(config, emitter);

        assert.calledOnce(BasicPool.create);
        assert.calledWith(BasicPool.create, config, emitter);
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

    describe("session reuse across pool limiters", () => {
        const nextTick = () => new Promise(resolve => setImmediate(resolve));

        const createPool = ({ parallelLimit, sessionsPerBrowser = 5, testsPerSession = 20 }) => {
            const active = new Set();
            const sessions = [];
            let peak = 0;
            const transport = {
                getBrowser: sinon.stub().callsFake(async (id, { version }) => {
                    const browser = {
                        id,
                        version,
                        fullId: `${id}.${version}`,
                        sessionId: sessions.length + 1,
                        reset: sinon.stub().resolves(),
                    };
                    sessions.push(browser);
                    active.add(browser);
                    peak = Math.max(peak, active.size);
                    return browser;
                }),
                freeBrowser: sinon.stub().callsFake(async browser => {
                    assert.isTrue(active.delete(browser));
                }),
                cancel: sinon.stub().callsFake(() => active.clear()),
            };
            sandbox.stub(BasicPool, "create").returns(transport);
            const config = {
                system: { parallelLimit },
                getBrowserIds: () => ["chrome", "firefox"],
                forBrowser: () => ({ sessionsPerBrowser, testsPerSession }),
            };
            const browserPool = pool.create(config, new EventEmitter());

            const run = (requests, freeOptions) =>
                Promise.all(
                    requests.map(async ({ id = "chrome", version = "123", ...options } = {}) => {
                        const browser = await browserPool.getBrowser(id, { version, ...options });
                        await nextTick();
                        await browserPool.freeBrowser(browser, freeOptions);
                        return browser.sessionId;
                    }),
                );

            return { pool: browserPool, run, sessions, active, transport, getPeak: () => peak };
        };

        [
            [1, 1, 4, 1],
            [1, 5, 4, 1],
            [3, 5, 4, 3],
            [3, 3, 4, 3],
            [3, 1, 4, 1],
            [Infinity, 2, 4, 2],
        ].forEach(([parallelLimit, sessionsPerBrowser, count, expectedSessions]) => {
            it(`should use ${expectedSessions} sessions for ${count} tests with limits ${parallelLimit}/${sessionsPerBrowser}`, async () => {
                const fixture = createPool({ parallelLimit, sessionsPerBrowser });
                const ids = await fixture.run(Array.from({ length: count }, () => ({})));

                assert.equal(new Set(ids).size, expectedSessions);
                assert.lengthOf(fixture.sessions, expectedSessions);
                assert.isAtMost(fixture.getPeak(), Math.min(parallelLimit, sessionsPerBrowser));
                assert.equal(fixture.active.size, 0);
            });
        });

        it("should close a session after testsPerSession uses", async () => {
            const fixture = createPool({ parallelLimit: 1, testsPerSession: 2 });

            assert.deepEqual(await fixture.run(Array.from({ length: 5 }, () => ({}))), [1, 1, 2, 2, 3]);
            assert.equal(fixture.active.size, 0);
        });

        it("should not cache sessions when forced to close", async () => {
            const fixture = createPool({ parallelLimit: 1 });

            assert.deepEqual(await fixture.run([{}, {}, {}], { force: true }), [1, 2, 3]);
            assert.equal(fixture.active.size, 0);
        });

        [
            [{ id: "chrome" }, { id: "firefox" }, { id: "chrome" }],
            [{ version: "123" }, { version: "124" }, { version: "123" }],
        ].forEach(requests => {
            it(`should respect the global limit when switching browsers or versions: ${JSON.stringify(
                requests,
            )}`, async () => {
                const fixture = createPool({ parallelLimit: 1 });

                assert.deepEqual(await fixture.run(requests), [1, 2, 3]);
                assert.equal(fixture.getPeak(), 1);
                assert.equal(fixture.active.size, 0);
            });
        });

        it("should consider high priority requests when reusing sessions", async () => {
            const fixture = createPool({ parallelLimit: 1 });

            const ids = await fixture.run([{}, { id: "firefox" }, { highPriority: true }]);

            assert.deepEqual(ids, [1, 2, 1]);
            assert.equal(fixture.getPeak(), 1);
            assert.equal(fixture.active.size, 0);
        });

        [1, 3, 6].forEach(parallelLimit => {
            it(`should drain a mixed queue without exceeding the global limit ${parallelLimit}`, async () => {
                const fixture = createPool({ parallelLimit, sessionsPerBrowser: 2 });
                const requests = Array.from({ length: 30 }, (_, index) => ({
                    id: index % 3 === 0 ? "firefox" : "chrome",
                    version: index % 4 === 0 ? "124" : "123",
                    highPriority: index % 7 === 0,
                }));

                const ids = await fixture.run(requests);

                ids.forEach((id, index) => {
                    assert.include(fixture.sessions[id - 1], {
                        id: requests[index].id,
                        version: requests[index].version,
                    });
                });
                assert.isAtMost(fixture.getPeak(), parallelLimit);
                assert.equal(fixture.active.size, 0);
            });
        });

        it("should continue the queue after a session creation failure", async () => {
            const fixture = createPool({ parallelLimit: 1 });
            fixture.transport.getBrowser.onFirstCall().rejects(new Error("Session creation failed"));

            const failed = fixture.run([{}]);
            const next = fixture.run([{}, {}]);

            await assert.isRejected(failed, "Session creation failed");
            assert.deepEqual(await next, [1, 1]);
            assert.equal(fixture.active.size, 0);
        });

        it("should close the browser and reject the queued request on cancellation", async () => {
            const fixture = createPool({ parallelLimit: 1 });
            await fixture.pool.getBrowser("chrome", { version: "123" });
            const pending = fixture.pool.getBrowser("chrome", { version: "123" });
            const rejection = assert.isRejected(pending, "Run cancelled");

            fixture.pool.cancel(new Error("Run cancelled"));

            await rejection;
            assert.equal(fixture.active.size, 0);
        });
    });
});
