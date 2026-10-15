"use strict";

const { setImmediate } = require("node:timers/promises");
const proxyquire = require("proxyquire");

const { cleanupRrweb, installRrwebAndCollectEvents } = require("src/browser/history/rrweb");

describe("browser/history/rrweb", () => {
    const sandbox = sinon.createSandbox();

    afterEach(() => sandbox.restore());

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

    describe("concurrent rrweb installation", () => {
        let session;

        const installed = events => ({
            isRrwebInstalled: true,
            rrwebEvents: events,
        });
        const missing = () => ({
            isRrwebInstalled: false,
            rrwebEvents: [],
        });
        const unsupported = evalError => ({
            isRrwebSupported: false,
            isRrwebInstalled: false,
            rrwebEvents: [],
            evalError,
        });
        const deferred = () => {
            let resolve, reject;
            const promise = new Promise((resolveFn, rejectFn) => {
                resolve = resolveFn;
                reject = rejectFn;
            });

            return {
                promise,
                resolve,
                reject,
            };
        };
        const prepareSession = async (collect = installRrwebAndCollectEvents) => {
            session.execute.resolves(installed([]));
            await collect(session, {});
            session.execute.reset();
        };
        const uploads = browser => browser.execute.getCalls().filter(call => typeof call.args[1] === "string");
        const createDebugApi = () => {
            const debug = sandbox.spy();

            debug.enabled = true;

            return {
                debug,
                api: proxyquire("src/browser/history/rrweb", {
                    debug: () => debug,
                }),
            };
        };

        beforeEach(() => {
            session = {
                capabilities: {},
                execute: sandbox.stub(),
            };
        });

        it("should share an upload after navigation and collect distinct events for each caller", async () => {
            await prepareSession();

            const upload = deferred();
            const uploadStarted = deferred();
            const probesStarted = deferred();
            const followersStarted = deferred();
            const followers = deferred();
            let probes = 0;
            let followupProbes = 0;
            let batch = 0;

            session.execute.callsFake((_, code) => {
                if (code) {
                    uploadStarted.resolve();

                    return upload.promise.then(() => installed([++batch]));
                }

                if (probes < 8) {
                    probes += 1;

                    if (probes === 8) {
                        probesStarted.resolve();
                    }

                    return Promise.resolve(missing());
                }

                followupProbes += 1;

                if (followupProbes === 7) {
                    followersStarted.resolve();
                }

                return followers.promise.then(() => installed([++batch]));
            });

            const collections = Array.from(
                {
                    length: 8,
                },
                () => installRrwebAndCollectEvents(session, {}),
            );

            await probesStarted.promise;
            await uploadStarted.promise;
            await setImmediate();
            assert.lengthOf(uploads(session), 1);
            upload.resolve();
            await followersStarted.promise;
            followers.resolve();

            const events = await Promise.all(collections);

            assert.lengthOf(uploads(session), 1);
            assert.isTrue(events.every(eventsForCall => eventsForCall.length === 1));
            assert.sameMembers(events.flat(), [1, 2, 3, 4, 5, 6, 7, 8]);
        });

        it("should share an upload when rrweb has not been sent to the session yet", async () => {
            const upload = deferred();
            const probeStarted = deferred();

            session.execute.onFirstCall().returns(upload.promise);
            session.execute.onSecondCall().callsFake(() => {
                probeStarted.resolve();

                return Promise.resolve(missing());
            });
            session.execute.resolves(installed(["follower"]));

            const first = installRrwebAndCollectEvents(session, {});
            const second = installRrwebAndCollectEvents(session, {});

            await probeStarted.promise;
            upload.resolve(installed(["leader"]));

            assert.deepEqual(await Promise.all([first, second]), [["leader"], ["follower"]]);
            assert.lengthOf(uploads(session), 1);
        });

        it("should not serialize collections when rrweb is already installed", async () => {
            await prepareSession();

            const collection = deferred();

            session.execute.returns(collection.promise);

            const first = installRrwebAndCollectEvents(session, {});
            const second = installRrwebAndCollectEvents(session, {});

            assert.calledTwice(session.execute);
            assert.lengthOf(uploads(session), 0);
            collection.resolve(installed([]));
            await Promise.all([first, second]);
        });

        it("should install rrweb in different sessions concurrently", async () => {
            const firstUpload = deferred();
            const secondUpload = deferred();
            const otherSession = {
                capabilities: {},
                execute: sandbox.stub().returns(secondUpload.promise),
            };

            session.execute.returns(firstUpload.promise);

            const first = installRrwebAndCollectEvents(session, {});
            const second = installRrwebAndCollectEvents(otherSession, {});

            assert.lengthOf(uploads(session), 1);
            assert.lengthOf(uploads(otherSession), 1);
            firstUpload.resolve(installed(["first"]));
            secondUpload.resolve(installed(["second"]));

            assert.deepEqual(await Promise.all([first, second]), [["first"], ["second"]]);
        });

        it("should allow a waiting caller to recover after an upload rejects", async () => {
            await prepareSession();

            const upload = deferred();
            const uploadStarted = deferred();
            const followerProbeStarted = deferred();
            const error = new Error("upload failed");

            session.execute.resolves(installed(["recovered"]));
            session.execute.onCall(0).resolves(missing());
            session.execute.onCall(1).callsFake(() => {
                uploadStarted.resolve();

                return upload.promise;
            });
            session.execute.onCall(2).callsFake(() => {
                followerProbeStarted.resolve();

                return Promise.resolve(missing());
            });
            session.execute.onCall(3).resolves(missing());

            const first = installRrwebAndCollectEvents(session, {});
            const rejection = assert.isRejected(first);

            await uploadStarted.promise;

            const second = installRrwebAndCollectEvents(session, {});

            await followerProbeStarted.promise;
            upload.reject(error);

            assert.strictEqual(await rejection, error);
            assert.deepEqual(await second, ["recovered"]);
            assert.lengthOf(uploads(session), 2);
        });

        it("should not retry an unsupported installation from waiting callers", async () => {
            const upload = deferred();
            const probeStarted = deferred();

            session.execute.onFirstCall().returns(upload.promise);
            session.execute.callsFake(() => {
                probeStarted.resolve();

                return Promise.resolve(missing());
            });

            const first = installRrwebAndCollectEvents(session, {});
            const second = installRrwebAndCollectEvents(session, {});

            await probeStarted.promise;
            upload.resolve(unsupported("unsupported syntax"));

            assert.deepEqual(await Promise.all([first, second]), [[], []]);
            await installRrwebAndCollectEvents(session, {});
            assert.lengthOf(uploads(session), 1);
        });

        it("should upload again if navigation removes rrweb while a caller is waiting", async () => {
            const upload = deferred();
            const probeStarted = deferred();

            session.execute.onFirstCall().returns(upload.promise);
            session.execute.callsFake((_, code) => {
                if (code) {
                    return Promise.resolve(installed(["new document"]));
                }

                probeStarted.resolve();

                return Promise.resolve(missing());
            });

            const first = installRrwebAndCollectEvents(session, {});
            const second = installRrwebAndCollectEvents(session, {});

            await probeStarted.promise;
            upload.resolve(installed(["old document"]));

            assert.deepEqual(await Promise.all([first, second]), [["old document"], ["new document"]]);
            assert.lengthOf(uploads(session), 2);
        });

        it("should allow installation after cleanup", async () => {
            session.execute.resolves(installed([]));
            await installRrwebAndCollectEvents(session, {});
            await cleanupRrweb(session, {});
            session.execute.resetHistory();

            await installRrwebAndCollectEvents(session, {});

            assert.lengthOf(uploads(session), 1);
        });

        it("should not clear a new upload when an upload from before cleanup completes", async () => {
            const oldUpload = deferred();
            const newUpload = deferred();
            const probeStarted = deferred();

            session.execute.onCall(0).returns(oldUpload.promise);
            session.execute.onCall(1).resolves();
            session.execute.onCall(2).returns(newUpload.promise);
            session.execute.onCall(3).callsFake(() => {
                probeStarted.resolve();

                return Promise.resolve(missing());
            });
            session.execute.resolves(installed(["follower"]));

            const oldCollection = installRrwebAndCollectEvents(session, {});

            await cleanupRrweb(session, {});

            const newCollection = installRrwebAndCollectEvents(session, {});

            oldUpload.resolve(installed(["old"]));
            assert.deepEqual(await oldCollection, []);

            const follower = installRrwebAndCollectEvents(session, {});

            await probeStarted.promise;
            newUpload.resolve(installed(["new"]));

            assert.deepEqual(await Promise.all([newCollection, follower]), [["new"], ["follower"]]);
            assert.lengthOf(uploads(session), 2);
        });

        it("should stop retrying if repeated navigation keeps removing rrweb", async () => {
            const firstUpload = deferred();
            const secondUpload = deferred();

            session.execute.callsFake((_, code) => {
                if (!code) {
                    return Promise.resolve(missing());
                }

                const count = uploads(session).length;

                if (count === 1) {
                    return firstUpload.promise;
                }

                if (count === 2) {
                    return secondUpload.promise;
                }

                return Promise.resolve(installed([count]));
            });

            const collections = Array.from(
                {
                    length: 4,
                },
                () => installRrwebAndCollectEvents(session, {}),
            );

            await setImmediate();
            firstUpload.resolve(installed([1]));
            await setImmediate();
            assert.lengthOf(uploads(session), 2);
            secondUpload.resolve(installed([2]));

            const results = await Promise.all(collections);

            assert.lengthOf(uploads(session), 2);
            assert.sameMembers(results.flat(), [1, 2]);
            assert.lengthOf(
                results.filter(events => events.length === 0),
                2,
            );
        });

        it("should allow another installation after execute throws synchronously", async () => {
            const error = new Error("execute failed synchronously");

            session.execute.throws(error);

            assert.strictEqual(await assert.isRejected(installRrwebAndCollectEvents(session, {})), error);

            session.execute.callsFake((_, code) => Promise.resolve(code ? installed(["recovered"]) : missing()));

            assert.deepEqual(await installRrwebAndCollectEvents(session, {}), ["recovered"]);
            assert.lengthOf(uploads(session), 2);
        });

        describe("cleanup generations", () => {
            for (const cleanupPending of [false, true]) {
                const timing = cleanupPending ? "during cleanup" : "after cleanup";

                for (const scenario of [
                    {
                        title: "ignore unsupported results",
                        prepared: false,
                        result: unsupported("old unsupported result"),
                        expectedUploads: 2,
                    },
                    {
                        title: "not upload code for a missing result",
                        prepared: true,
                        result: missing(),
                        expectedUploads: 1,
                    },
                ]) {
                    it(`should ${scenario.title} arriving ${timing}`, async () => {
                        if (scenario.prepared) {
                            await prepareSession();
                        }

                        const response = deferred();
                        const cleanup = deferred();

                        session.execute.onCall(0).returns(response.promise);
                        session.execute.onCall(1).returns(cleanup.promise);
                        session.execute.resolves(installed(["new test"]));

                        const oldCollection = installRrwebAndCollectEvents(session, {});
                        const cleaning = cleanupRrweb(session, {});

                        if (!cleanupPending) {
                            cleanup.resolve();
                            await cleaning;
                        }

                        response.resolve(scenario.result);

                        assert.deepEqual(await oldCollection, []);
                        assert.lengthOf(uploads(session), scenario.expectedUploads - 1);
                        cleanup.resolve();
                        await cleaning;

                        assert.deepEqual(await installRrwebAndCollectEvents(session, {}), ["new test"]);
                        assert.lengthOf(uploads(session), scenario.expectedUploads);
                    });
                }

                it(`should not probe again when a waiting upload completes ${timing}`, async () => {
                    const upload = deferred();
                    const cleanup = deferred();

                    session.execute.onCall(0).returns(upload.promise);
                    session.execute.onCall(1).resolves(missing());
                    session.execute.onCall(2).returns(cleanup.promise);
                    session.execute.resolves(installed(["new test"]));

                    const first = installRrwebAndCollectEvents(session, {});
                    const follower = installRrwebAndCollectEvents(session, {});

                    await setImmediate();

                    const cleaning = cleanupRrweb(session, {});

                    if (!cleanupPending) {
                        cleanup.resolve();
                        await cleaning;
                    }

                    upload.resolve(installed(["old test"]));

                    assert.deepEqual(await Promise.all([first, follower]), [[], []]);
                    assert.callCount(session.execute, 3);
                    cleanup.resolve();
                    await cleaning;
                });
            }

            it("should discard events from a collection invalidated by cleanup", async () => {
                await prepareSession();

                const probe = deferred();

                session.execute.onCall(0).returns(probe.promise);
                session.execute.resolves(installed([]));

                const collection = installRrwebAndCollectEvents(session, {});

                // runRunnables races collections against a timeout, so cleanup can precede a late response.
                await cleanupRrweb(session, {});
                probe.resolve(installed(["stale events"]));

                assert.deepEqual(await collection, []);
                assert.calledTwice(session.execute);
            });

            for (const cleanupCount of [1, 2]) {
                it(`should preserve a new installation when ${cleanupCount} older cleanups complete`, async () => {
                    const cleanup = deferred();

                    session.execute.callsFake(function () {
                        return arguments.length === 1 ? cleanup.promise : Promise.resolve(installed(["new test"]));
                    });

                    const cleanings = Array.from(
                        {
                            length: cleanupCount,
                        },
                        () => cleanupRrweb(session, {}),
                    );

                    assert.deepEqual(await installRrwebAndCollectEvents(session, {}), ["new test"]);
                    assert.lengthOf(uploads(session), 1);
                    cleanup.resolve();
                    await Promise.all(cleanings);
                    session.execute.resetHistory();

                    assert.deepEqual(await installRrwebAndCollectEvents(session, {}), ["new test"]);
                    assert.lengthOf(uploads(session), 0);
                });
            }
        });

        it("should preserve evalError for waiting callers and log upload diagnostics", async () => {
            const {
                debug,
                api: { installRrwebAndCollectEvents: installWithDebug },
            } = createDebugApi();
            const upload = deferred();

            session.execute.onFirstCall().returns(upload.promise);
            session.execute.resolves(missing());

            const first = installWithDebug(session, {});
            const follower = installWithDebug(session, {});

            await setImmediate();
            upload.resolve(unsupported("unsupported syntax"));

            assert.deepEqual(await Promise.all([first, follower]), [[], []]);

            const unsupportedLogs = debug.getCalls().filter(call => call.args[0].startsWith("rrweb is not supported"));

            assert.lengthOf(unsupportedLogs, 2);
            assert.isTrue(unsupportedLogs.every(call => call.args[2] === "unsupported syntax"));
            assert.calledWith(debug, "uploading rrweb code (%d bytes)", Buffer.byteLength(uploads(session)[0].args[1]));
            assert.calledWith(debug, "waiting for in-flight rrweb upload");
            assert.lengthOf(uploads(session), 1);
        });

        for (const stage of ["upload", "probe", "follower probe"]) {
            it(`should log events discarded after cleanup during ${stage}`, async () => {
                const { debug, api } = createDebugApi();
                const result = deferred();
                let collection;

                if (stage === "follower probe") {
                    const upload = deferred();
                    const probeStarted = deferred();

                    session.execute.onCall(0).returns(upload.promise);
                    session.execute.onCall(1).resolves(missing());
                    session.execute.onCall(2).callsFake(() => {
                        probeStarted.resolve();

                        return result.promise;
                    });
                    session.execute.resolves(installed([]));

                    const leader = api.installRrwebAndCollectEvents(session, {});

                    collection = api.installRrwebAndCollectEvents(session, {});
                    await setImmediate();
                    upload.resolve(installed([]));
                    await leader;
                    await probeStarted.promise;
                } else {
                    if (stage === "probe") {
                        await prepareSession(api.installRrwebAndCollectEvents);
                    }

                    session.execute.onFirstCall().returns(result.promise);
                    session.execute.resolves(installed([]));
                    collection = api.installRrwebAndCollectEvents(session, {});
                }

                await api.cleanupRrweb(session, {});
                result.resolve(installed([1, 2]));

                assert.deepEqual(await collection, []);

                const dropLogs = debug
                    .getCalls()
                    .filter(call => call.args[0] === "dropping %d rrweb events collected before cleanup");

                assert.lengthOf(dropLogs, 1);
                assert.strictEqual(dropLogs[0].args[1], 2);
            });
        }
    });
});
