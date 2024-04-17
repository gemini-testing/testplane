import _ from "lodash";
import proxyquire from "proxyquire";
import sinon, { type SinonSpy, type SinonStub } from "sinon";
import type { ChildProcessWithoutNullStreams } from "child_process";
import type { PartialDeep } from "type-fest";
import { waitDevServerReady, findCwd } from "../../../src/dev-server/utils";
import defaultConfig from "../../../src/config/defaults";
import type { Config } from "../../../src/config";

type WaitDevServerReady = typeof waitDevServerReady;
type FindCwd = typeof findCwd;

type ReadinessProbeConfig = Config["devServer"]["readinessProbe"];

type UtilsModule = { waitDevServerReady: WaitDevServerReady; findCwd: FindCwd };

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

            const cwd = utils.findCwd("/foo/bar/.hermione.conf.js");

            assert.equal(cwd, "/foo/bar");
        });

        it("should return parent directory which has package.json", () => {
            fsExistsSyncStub.withArgs("/foo/bar/package.json").returns(true);

            const cwd = utils.findCwd("/foo/bar/baz/qux/.hermione.conf.js");

            assert.equal(cwd, "/foo/bar");
        });

        it("should fallback to config directory if package json is not found", () => {
            const cwd = utils.findCwd("/foo/bar/baz/qux/.hermione.conf.js");

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
    });
});
