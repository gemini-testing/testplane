import _ from "lodash";
import proxyquire from "proxyquire";
import sinon, { type SinonSpy, type SinonStub } from "sinon";
import type { ChildProcessWithoutNullStreams } from "child_process";
import type { PartialDeep } from "type-fest";
import { waitDevServerReady, findCwd, probeServer } from "../../../src/dev-server/utils";
import defaultConfig from "../../../src/config/defaults";
import type { Config } from "../../../src/config";

type WaitDevServerReady = typeof waitDevServerReady;
type FindCwd = typeof findCwd;
type ProbeServer = typeof probeServer;

type ReadinessProbeConfig = Config["devServer"]["readinessProbe"];
// eslint-disable-next-line @typescript-eslint/ban-types
type ReadinessProbeConfigObject = Exclude<ReadinessProbeConfig, Function>;

type UtilsModule = { waitDevServerReady: WaitDevServerReady; findCwd: FindCwd; probeServer: ProbeServer };

describe("dev-server/utlls", () => {
    const sandbox = sinon.createSandbox();

    let utils: UtilsModule;
    let fsExistsSyncStub: SinonStub;
    let loggerStub: { log: SinonStub; warn: SinonStub };
    let fetchStub = globalThis.fetch as SinonStub;
    let setTimeoutSpy: SinonSpy;

    beforeEach(() => {
        fetchStub = sandbox.stub(globalThis, "fetch");
        setTimeoutSpy = sandbox.spy(globalThis, "setTimeout");

        fsExistsSyncStub = sandbox.stub().returns(false);

        loggerStub = { log: sandbox.stub(), warn: sandbox.stub() };

        utils = proxyquire("src/dev-server/utils", {
            fs: { existsSync: fsExistsSyncStub },
            "../utils/logger": loggerStub,
        });
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("findCwd", () => {
        it("should return passed directory if near package.json exists", () => {
            fsExistsSyncStub.withArgs("/foo/bar/package.json").returns(true);

            const cwd = utils.findCwd("/foo/bar/.testplane.conf.js");

            assert.equal(cwd, "/foo/bar");
        });

        it("should return parent directory which has package.json", () => {
            fsExistsSyncStub.withArgs("/foo/bar/package.json").returns(true);

            const cwd = utils.findCwd("/foo/bar/baz/qux/.testplane.conf.js");

            assert.equal(cwd, "/foo/bar");
        });

        it("should fallback to config directory if package json is not found", () => {
            const cwd = utils.findCwd("/foo/bar/baz/qux/.testplane.conf.js");

            assert.equal(cwd, "/foo/bar/baz/qux");
        });
    });

    describe("waitDevServerReady", () => {
        const createReadinessProbe_ = (opts: PartialDeep<ReadinessProbeConfig> = {}): ReadinessProbeConfig => {
            return _.defaultsDeep(opts, defaultConfig.devServer.readinessProbe);
        };

        const promiseDelay_ = <T>(timeout: number, response: T | void): Promise<T> =>
            new Promise<T>(resolve => {
                setTimeoutSpy(() => {
                    resolve(response as T extends void ? never : T);
                }, timeout);
            });

        it("should use readinessProbe function if defined", async () => {
            const devServer = {} as ChildProcessWithoutNullStreams;
            const readinessProbeResult = Promise.resolve({ foo: "bar" });
            const readinessProbeFn = sandbox.stub().withArgs(devServer).returns(readinessProbeResult);

            const result = (await utils.waitDevServerReady(devServer, readinessProbeFn)) as unknown;

            assert.deepEqual(result, { foo: "bar" });
        });

        it("should return if readinessProbe section is undefined", async () => {
            const devServer = {} as ChildProcessWithoutNullStreams;

            await utils.waitDevServerReady(devServer, createReadinessProbe_());

            assert.notCalled(loggerStub.log);
            assert.notCalled(globalThis.fetch as SinonStub);
        });

        it("should fail on timeout", () => {
            const devServer = {} as ChildProcessWithoutNullStreams;
            fetchStub.withArgs("foo").returns(promiseDelay_(5));

            const promise = utils.waitDevServerReady(
                devServer,
                createReadinessProbe_({
                    url: "foo",
                    timeouts: { waitServerTimeout: 5 },
                }),
            );

            return assert.isRejected(promise, "Dev server is still not ready after 5ms");
        });

        it("should resolve on success", async () => {
            const devServer = {} as ChildProcessWithoutNullStreams;
            fetchStub.withArgs("foo").returns(promiseDelay_(5, { status: 200 }));

            await utils.waitDevServerReady(devServer, createReadinessProbe_({ url: "foo" }));

            assert.calledOnceWith(fetchStub, "foo");
        });

        it("should use custom isReady function", async () => {
            const devServer = {} as ChildProcessWithoutNullStreams;
            let retryCount = 0;
            fetchStub.withArgs("foo").callsFake(() => promiseDelay_(5, { status: 200 + retryCount++ }));

            await utils.waitDevServerReady(
                devServer,
                createReadinessProbe_({
                    url: "foo",
                    isReady: response => response.status === 201,
                    timeouts: {
                        probeRequestInterval: 2,
                    },
                }),
            );

            assert.calledTwice(fetchStub);
        });

        describe("logs", () => {
            it("should log dev server is waiting", async () => {
                const devServer = {} as ChildProcessWithoutNullStreams;
                fetchStub.withArgs("foo").returns(promiseDelay_(5, { status: 200 }));

                await utils.waitDevServerReady(devServer, createReadinessProbe_({ url: "foo" }));

                assert.calledWith(loggerStub.log, "Waiting for dev server to be ready");
            });

            it("should log dev server is ready on resolve", async () => {
                const devServer = {} as ChildProcessWithoutNullStreams;
                fetchStub.withArgs("foo").returns(promiseDelay_(5, { status: 200 }));

                await utils.waitDevServerReady(devServer, createReadinessProbe_({ url: "foo" }));

                assert.calledWith(loggerStub.log, "Dev server is ready");
            });

            it("should not log dev server is ready on reject", async () => {
                const devServer = {} as ChildProcessWithoutNullStreams;
                fetchStub.withArgs("foo").returns(promiseDelay_(5));

                await utils
                    .waitDevServerReady(
                        devServer,
                        createReadinessProbe_({
                            url: "foo",
                            timeouts: { waitServerTimeout: 5 },
                        }),
                    )
                    .catch(_.noop);

                assert.calledWith(loggerStub.log, "Waiting for dev server to be ready");
                assert.neverCalledWith(loggerStub.log, "Dev server is ready");
            });

            it("should not warn probe fail on ECONNRESET", async () => {
                const devServer = {} as ChildProcessWithoutNullStreams;
                fetchStub
                    .withArgs("foo")
                    .returns(new Promise((_, rej) => setTimeout(() => rej({ cause: { code: "ECONNREFUSED" } }), 1)));

                await utils
                    .waitDevServerReady(
                        devServer,
                        createReadinessProbe_({
                            url: "foo",
                            timeouts: {
                                waitServerTimeout: 10,
                                probeRequestInterval: 1,
                            },
                        }),
                    )
                    .catch(_.noop);

                assert.neverCalledWith(loggerStub.warn, /Dev server ready probe failed/);
            });

            it("should not warn probe fail", async () => {
                const devServer = {} as ChildProcessWithoutNullStreams;
                fetchStub.withArgs("foo").returns(
                    new Promise((_, rej) =>
                        setTimeout(() => {
                            rej({ cause: { code: "some error" } });
                        }, 1),
                    ),
                );

                await utils
                    .waitDevServerReady(
                        devServer,
                        createReadinessProbe_({
                            url: "foo",
                            timeouts: {
                                waitServerTimeout: 10,
                                probeRequestInterval: 1,
                            },
                        }),
                    )
                    .catch(_.noop);

                assert.calledWith(loggerStub.warn, "Dev server ready probe failed:", "some error");
            });
        });

        describe("probeServer", () => {
            const createReadinessProbe_ = (
                opts: PartialDeep<ReadinessProbeConfig> = {},
            ): ReadinessProbeConfigObject => {
                return _.defaultsDeep(opts, defaultConfig.devServer.readinessProbe);
            };

            it("should throw error when url is not a string", async () => {
                const readinessProbe = createReadinessProbe_({ url: null });

                try {
                    await utils.probeServer(readinessProbe);
                    assert.fail("Expected error to be thrown");
                } catch (error) {
                    assert.match((error as Error).message, /devServer.readinessProbe.url should be set to url/);
                }

                assert.notCalled(fetchStub);
            });

            it("should return true when server responds with success status", async () => {
                const readinessProbe = createReadinessProbe_({ url: "http://localhost:3000" });
                fetchStub.resolves({ status: 200 });

                const result = await utils.probeServer(readinessProbe);

                assert.isTrue(result);
                assert.calledOnceWith(fetchStub, "http://localhost:3000", { signal: sinon.match.any });
            });

            it("should return false when server responds with error status", async () => {
                const readinessProbe = createReadinessProbe_({ url: "http://localhost:3000" });
                fetchStub.resolves({ status: 500 });

                const result = await utils.probeServer(readinessProbe);

                assert.isFalse(result);
                assert.calledOnceWith(fetchStub, "http://localhost:3000", { signal: sinon.match.any });
            });

            it("should use custom isReady function", async () => {
                const customIsReady = sandbox.stub().resolves(true);
                const readinessProbe = createReadinessProbe_({
                    url: "http://localhost:3000",
                    isReady: customIsReady,
                });
                const mockResponse = { status: 500 };
                fetchStub.resolves(mockResponse);

                const result = await utils.probeServer(readinessProbe);

                assert.isTrue(result);
                assert.calledOnceWith(customIsReady, mockResponse);
            });

            it("should return false when custom isReady function returns false", async () => {
                const customIsReady = sandbox.stub().resolves(false);
                const readinessProbe = createReadinessProbe_({
                    url: "http://localhost:3000",
                    isReady: customIsReady,
                });
                fetchStub.resolves({ status: 200 });

                const result = await utils.probeServer(readinessProbe);

                assert.isFalse(result);
                assert.calledOnce(customIsReady);
            });

            it("should return false when fetch throws ECONNREFUSED error", async () => {
                const readinessProbe = createReadinessProbe_({ url: "http://localhost:3000" });
                fetchStub.rejects({ cause: { code: "ECONNREFUSED" } });

                const result = await utils.probeServer(readinessProbe);

                assert.isFalse(result);
                assert.notCalled(loggerStub.warn);
            });

            it("should return false and log warning when fetch throws other errors", async () => {
                const readinessProbe = createReadinessProbe_({ url: "http://localhost:3000" });
                fetchStub.rejects({ cause: { code: "ETIMEDOUT" } });

                const result = await utils.probeServer(readinessProbe);

                assert.isFalse(result);
                assert.calledWith(loggerStub.warn, "Dev server ready probe failed:", "ETIMEDOUT");
            });

            it("should return false and log warning when fetch throws error with cause string", async () => {
                const readinessProbe = createReadinessProbe_({ url: "http://localhost:3000" });
                fetchStub.rejects({ cause: "Network error" });

                const result = await utils.probeServer(readinessProbe);

                assert.isFalse(result);
                assert.calledWith(loggerStub.warn, "Dev server ready probe failed:", "Network error");
            });

            it("should return false when fetch throws error without cause", async () => {
                const readinessProbe = createReadinessProbe_({ url: "http://localhost:3000" });
                fetchStub.rejects(new Error("Generic error"));

                const result = await utils.probeServer(readinessProbe);

                assert.isFalse(result);
                assert.notCalled(loggerStub.warn);
            });

            it("should use AbortSignal with timeout from readinessProbe", async () => {
                const readinessProbe = createReadinessProbe_({
                    url: "http://localhost:3000",
                    timeouts: { probeRequestTimeout: 5000 },
                });
                fetchStub.resolves({ status: 200 });

                await utils.probeServer(readinessProbe);

                assert.calledOnceWith(fetchStub, "http://localhost:3000", {
                    signal: sinon.match.instanceOf(AbortSignal),
                });
            });
        });
    });
});
