"use strict";

const vm = require("node:vm");
const { cleanupRrweb, installRrwebAndCollectEvents } = require("src/browser/history/rrweb");

describe("browser/history/rrweb", () => {
    const sandbox = sinon.createSandbox();

    afterEach(() => sandbox.restore());

    const createNativeDate = () => vm.runInNewContext("Date");

    const createPerformance = ({ isNative = true } = {}) => ({
        timeOrigin: 1000,
        now: isNative ? Math.max.bind(null, 234.6) : () => 234.6,
    });

    const createSession = ({ browserDate, performance }) => {
        const window = {};
        let recordReturned = false;
        let emitWasSynchronous = false;
        let serverTime;

        window.eval = () => {
            const record = ({ emit }) => {
                emitWasSynchronous = !recordReturned;
                emit({ type: 1, timestamp: 0, data: { id: 1 } });
                emit({ type: 2, timestamp: 0, data: { id: 2 } });
                recordReturned = true;

                return () => {};
            };
            record.addCustomEvent = () => {};
            window.rrweb = { record };
        };

        const execute = sandbox.stub().callsFake((script, rrwebRecordFnCode, fallbackTime) => {
            serverTime = fallbackTime;
            const context = vm.createContext({ performance, window });
            context.Date = browserDate;
            const browserScript = vm.runInContext(`(${script.toString()})`, context);

            return Promise.resolve(browserScript(rrwebRecordFnCode, fallbackTime));
        });

        return {
            session: {
                capabilities: { browserName: "chrome" },
                execute,
            },
            get serverTime() {
                return serverTime;
            },
            get emitWasSynchronous() {
                return emitWasSynchronous;
            },
        };
    };

    const createFakeDate = NativeDate => {
        const fakeDate = function FakeDate() {
            return new NativeDate(42);
        };
        fakeDate.prototype = NativeDate.prototype;

        return fakeDate;
    };

    describe("event timestamps", () => {
        it("should use performance timestamp for a fake Date with native date methods", async () => {
            const nativeDate = createNativeDate();
            const { session } = createSession({
                browserDate: createFakeDate(nativeDate),
                performance: createPerformance(),
            });

            const events = await installRrwebAndCollectEvents(session, {});

            assert.deepEqual(
                events.map(event => event.timestamp),
                [1234, 1234],
            );
        });

        it("should use server time when Date and performance are not trusted", async () => {
            const nativeDate = createNativeDate();
            const browser = createSession({
                browserDate: createFakeDate(nativeDate),
                performance: createPerformance({ isNative: false }),
            });

            const events = await installRrwebAndCollectEvents(browser.session, {});

            assert.deepEqual(
                events.map(event => event.timestamp),
                [browser.serverTime, browser.serverTime],
            );
        });

        it("should use native Date when Date.now is overridden", async () => {
            const nativeDate = createNativeDate();
            nativeDate.now = () => 42;
            const browser = createSession({
                browserDate: nativeDate,
                performance: createPerformance({ isNative: false }),
            });
            const before = Date.now();

            const events = await installRrwebAndCollectEvents(browser.session, {});

            const after = Date.now();
            assert.notEqual(events[0].timestamp, 42);
            assert.isAtLeast(events[0].timestamp, before - 1000);
            assert.isAtMost(events[0].timestamp, after + 1000);
        });

        it("should not trust a spoofed Date.now.toString", async () => {
            const nativeDate = createNativeDate();
            const fakeDateNow = () => 42;
            fakeDateNow.toString = () => "function now() { [native code] }";
            nativeDate.now = fakeDateNow;
            const browser = createSession({
                browserDate: nativeDate,
                performance: createPerformance({ isNative: false }),
            });
            const before = Date.now();

            const events = await installRrwebAndCollectEvents(browser.session, {});

            const after = Date.now();
            assert.notEqual(events[0].timestamp, 42);
            assert.isAtLeast(events[0].timestamp, before - 1000);
            assert.isAtMost(events[0].timestamp, after + 1000);
        });

        it("should preserve timestamps from a native Date", async () => {
            const browser = createSession({
                browserDate: createNativeDate(),
                performance: createPerformance({ isNative: false }),
            });
            const before = Date.now();

            const events = await installRrwebAndCollectEvents(browser.session, {});

            const after = Date.now();
            assert.isAtLeast(events[0].timestamp, before - 1000);
            assert.isAtMost(events[0].timestamp, after + 1000);
        });
    });

    it("should collect events synchronously and preserve their order", async () => {
        const browser = createSession({
            browserDate: createNativeDate(),
            performance: createPerformance(),
        });

        const events = await installRrwebAndCollectEvents(browser.session, {});

        assert.isTrue(browser.emitWasSynchronous);
        assert.deepEqual(
            events.map(event => event.data.id),
            [1, 2],
        );
    });

    describe("internet explorer", () => {
        let session;

        beforeEach(() => {
            session = {
                capabilities: { browserName: "internet explorer" },
                execute: sandbox.stub(),
            };
        });

        it("should not install rrweb", async () => {
            const events = await installRrwebAndCollectEvents(session, {});

            assert.deepEqual(events, []);
            assert.notCalled(session.execute);
        });

        it("should not clean up rrweb", async () => {
            await cleanupRrweb(session, {});

            assert.notCalled(session.execute);
        });
    });
});
