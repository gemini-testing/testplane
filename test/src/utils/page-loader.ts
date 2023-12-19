import proxyquire from "proxyquire";
import sinon, { SinonStub, SinonSpy } from "sinon";
import FakeTimers from "@sinonjs/fake-timers";
import { mkSessionStub_, mkMockStub_ } from "../browser/utils";
import type PageLoaderType from "../../../src/utils/page-loader";
import { Element, WaitForOptions } from "webdriverio";

type PageLoaderClass = typeof import("../../../src/utils/page-loader").default;
type PageLoaderSpy = Omit<PageLoaderType, "emit"> & { emit: SinonSpy };
type Logger = typeof import("../../../src/utils/logger");

type MockStub = {
    on: SinonSpy;
    emit: SinonSpy;
    restore: SinonStub;
};

const waitUntilMock = (condition: () => boolean, opts?: WaitForOptions): Promise<void> => {
    let rejectingTimeout: NodeJS.Timeout;
    let destroyed = false;

    return new Promise<void>((resolve, reject) => {
        const checkPredicate = (): void => {
            if (destroyed) {
                return;
            }

            if (condition()) {
                destroyed = true;
                clearTimeout(rejectingTimeout);
                resolve();
            } else {
                setTimeout(checkPredicate, 20);
            }
        };

        rejectingTimeout = setTimeout(() => {
            if (destroyed) {
                return;
            }

            destroyed = true;
            reject();
        }, opts?.timeout);

        checkPredicate();
    });
};

describe("utils/page-loader", () => {
    const sandbox = sinon.createSandbox();
    let clock: FakeTimers.InstalledClock, loggerStub: Logger, PageLoader: PageLoaderClass;

    const resolveNow_ = (): Promise<void> => Promise.resolve();
    const rejectNow_ = (): Promise<void> => Promise.reject();

    const resolveAfter_ = (ms: number): Promise<never> => {
        return new Promise<never>(resolve => setTimeout(resolve, ms));
    };
    const rejectAfter_ = (ms: number): Promise<never> => {
        return new Promise<never>((_, reject) => setTimeout(reject, ms));
    };

    const mkResolveAfter_ = (ms: number): (() => Promise<never>) => {
        return () => resolveAfter_(ms);
    };
    const mkRejectAfter_ = (ms: number): (() => Promise<never>) => {
        return () => rejectAfter_(ms);
    };

    const mkPageLoader_ = ({
        selectors = [".selector"],
        predicate = (): boolean => true,
        timeout = 500,
        waitNetworkIdle = true,
        waitNetworkIdleTimeout = 100,
    } = {}): { pageLoader: PageLoaderSpy; sessionStub: WebdriverIO.Browser; mockStub: MockStub } => {
        const mockStub = mkMockStub_();
        const sessionStub = mkSessionStub_() as unknown as WebdriverIO.Browser;
        const pageLoader = new PageLoader(sessionStub, {
            selectors,
            predicate,
            timeout,
            waitNetworkIdle,
            waitNetworkIdleTimeout,
        }) as unknown as PageLoaderSpy;

        sessionStub.mock = sandbox.stub().resolves(mockStub);
        sessionStub.waitUntil = sandbox.spy(waitUntilMock) as WebdriverIO.Browser["waitUntil"];

        sandbox.spy(pageLoader, "emit");

        return { pageLoader, sessionStub, mockStub };
    };

    beforeEach(() => {
        clock = FakeTimers.install();
        loggerStub = {
            log: sandbox.stub(),
            warn: sandbox.stub(),
            error: sandbox.stub(),
        };
        PageLoader = proxyquire("src/utils/page-loader", {
            "./logger": loggerStub,
        }).default;
    });

    afterEach(() => {
        sandbox.restore();
        clock.uninstall();
    });

    it("should handle selectors, predicate and network asynchronously", async () => {
        let resolvingValue = false;
        setTimeout(() => {
            resolvingValue = true;
        }, 500);
        const predicate = (): boolean => resolvingValue;

        const { pageLoader, sessionStub } = mkPageLoader_({
            selectors: [".selector"],
            predicate,
            waitNetworkIdleTimeout: 500,
            timeout: 1000,
        });

        const element = await sessionStub.$(".selector");
        sessionStub.$ = sandbox.stub().resolves(element);
        element.waitForExist = mkResolveAfter_(500);

        await pageLoader.load(resolveNow_);

        await clock.tickAsync(500);

        assert.calledWith(pageLoader.emit, "selectorsExist");
        assert.calledWith(pageLoader.emit, "predicateResolved");
        assert.calledWith(pageLoader.emit, "networkResolved");
    });

    it("should have union timeouts for selectors, predicate and network", async () => {
        const predicate = (): boolean => false;

        const { pageLoader, sessionStub, mockStub } = mkPageLoader_({
            selectors: [".selector"],
            predicate,
            timeout: 1000,
        });

        const element = await sessionStub.$(".selector");
        sessionStub.$ = sandbox.stub().resolves(element);
        element.waitForExist = mkRejectAfter_(1000);

        await pageLoader.load(resolveNow_);
        mockStub.emit("request");

        await clock.tickAsync(1000);

        assert.calledWith(pageLoader.emit, "selectorsError");
        assert.calledWith(pageLoader.emit, "predicateError");
        assert.calledWith(pageLoader.emit, "networkResolved");
    });

    describe("mock", () => {
        it("should be inited if 'waitNetworkIdle' is set", async () => {
            const { pageLoader, sessionStub, mockStub } = mkPageLoader_({ waitNetworkIdle: true });

            await pageLoader.load(resolveNow_);

            assert.calledOnceWith(sessionStub.mock, "**");
            assert.calledWith(mockStub.on, "request");
            assert.calledWith(mockStub.on, "continue");
            assert.calledWith(mockStub.on, "match");
        });

        it("should not be inited if 'waitNetworkIdle' is set to 'false'", async () => {
            const { pageLoader, sessionStub, mockStub } = mkPageLoader_({ waitNetworkIdle: false });

            await pageLoader.load(resolveNow_);

            assert.notCalled(sessionStub.mock as SinonStub);
            assert.notCalled(mockStub.on);
            assert.notCalled(mockStub.on);
            assert.notCalled(mockStub.on);
        });

        it("should be restored", async () => {
            const { pageLoader, mockStub } = mkPageLoader_({
                waitNetworkIdle: true,
                waitNetworkIdleTimeout: 0,
            });

            await pageLoader.load(resolveNow_);
            await pageLoader.unsubscribe();

            assert.calledOnce(mockStub.restore);
        });

        it("should not be restored if it was not inited", async () => {
            const { pageLoader, mockStub } = mkPageLoader_({
                waitNetworkIdle: false,
                waitNetworkIdleTimeout: 0,
            });

            await pageLoader.load(resolveNow_);
            await pageLoader.unsubscribe();

            assert.notCalled(mockStub.restore);
        });

        it("should warn on unsubscribe error", async () => {
            const { pageLoader, mockStub } = mkPageLoader_({
                waitNetworkIdle: true,
                waitNetworkIdleTimeout: 0,
            });
            mockStub.restore.rejects(new Error("err"));

            await pageLoader.load(resolveNow_);
            await pageLoader.unsubscribe();
            await clock.runAllAsync();

            assert.calledOnceWith(loggerStub.warn, "PageLoader: Got error while unsubscribing");
        });
    });

    describe("events", () => {
        it("should emit 'pageLoadError' after rejection", async () => {
            const { pageLoader } = mkPageLoader_();

            await pageLoader.load(rejectNow_);

            await clock.nextAsync();

            assert.calledWith(pageLoader.emit, "pageLoadError");
        });

        describe("selectors", () => {
            it("should wait with passed timeout", async () => {
                const { pageLoader, sessionStub } = mkPageLoader_({
                    selectors: [".selector"],
                    timeout: 100,
                });
                const element = await sessionStub.$(".selector");
                sessionStub.$ = sandbox.stub().resolves(element);
                element.waitForExist = sandbox.stub().callsFake(opts => rejectAfter_(opts?.timeout ?? 100500));

                await pageLoader.load(resolveNow_);

                assert.calledOnceWith(element.waitForExist, { timeout: 100 });
            });

            it("should emit 'selectorsExist' after selectors appear", async () => {
                const { pageLoader, sessionStub } = mkPageLoader_({
                    selectors: [".selector"],
                    timeout: 1000,
                });
                const element = await sessionStub.$(".selector");
                sessionStub.$ = sandbox.stub().resolves(element);
                element.waitForExist = mkResolveAfter_(100);

                await pageLoader.load(resolveNow_);

                await clock.tickAsync(50);
                assert.neverCalledWith(pageLoader.emit, "selectorsExist");
                await clock.tickAsync(100);
                assert.calledWith(pageLoader.emit, "selectorsExist");
                assert.neverCalledWith(pageLoader.emit, "selectorsError");
            });

            it("should emit 'selectorsError' after selectors timeout", async () => {
                const { pageLoader, sessionStub } = mkPageLoader_({
                    selectors: [".selector"],
                    timeout: 100,
                });
                const element = await sessionStub.$(".selector");
                sessionStub.$ = sandbox.stub().resolves(element);
                element.waitForExist = function (this: Element, opts?: WaitForOptions): Promise<never> {
                    return rejectAfter_(opts?.timeout ?? 100500);
                };

                await pageLoader.load(resolveNow_);

                await clock.tickAsync(50);
                assert.neverCalledWith(pageLoader.emit, "selectorsError");
                await clock.tickAsync(100);
                assert.calledWith(pageLoader.emit, "selectorsError");
                assert.neverCalledWith(pageLoader.emit, "selectorsExist");
            });
        });

        describe("predicate", () => {
            it("should emit 'predicateResolved' after predicate resolved", async () => {
                let resolvingValue = false;
                const predicate = (): boolean => resolvingValue;
                const { pageLoader } = mkPageLoader_({ predicate, timeout: 500 });
                setTimeout(() => {
                    resolvingValue = true;
                }, 100);

                await pageLoader.load(resolveNow_);

                await clock.tickAsync(50);
                assert.neverCalledWith(pageLoader.emit, "predicateResolved");
                await clock.tickAsync(100);
                assert.calledWith(pageLoader.emit, "predicateResolved");
            });

            it("should emit 'predicateError' after predicate timed out", async () => {
                const predicate = (): boolean => false;
                const { pageLoader } = mkPageLoader_({ predicate, timeout: 100 });

                await pageLoader.load(resolveNow_);

                await clock.tickAsync(50);
                assert.neverCalledWith(pageLoader.emit, "predicateError");
                await clock.tickAsync(100);
                assert.calledWith(pageLoader.emit, "predicateError");
            });
        });

        describe("network", () => {
            it("should emit 'networkResolved' after 'waitNetworkIdleTimeout' ms if there are no requests", async () => {
                const { pageLoader } = mkPageLoader_({ waitNetworkIdleTimeout: 100 });

                await pageLoader.load(resolveNow_);

                await clock.tickAsync(50);
                assert.neverCalledWith(pageLoader.emit, "networkResolved");
                await clock.tickAsync(100);
                assert.calledWith(pageLoader.emit, "networkResolved");
            });

            it("should emit 'networkError' on match with error status code", async () => {
                const { pageLoader, mockStub } = mkPageLoader_({ timeout: 300, waitNetworkIdleTimeout: 100 });
                const match = { statusCode: 404 };

                await pageLoader.load(resolveNow_);
                mockStub.emit("match", match);

                await clock.nextAsync();
                assert.calledWith(pageLoader.emit, "networkError", match);
            });

            it("should emit 'networkResolved' after 'waitNetworkIdleTimeout' ms if there are no requests", async () => {
                const { pageLoader } = mkPageLoader_({ waitNetworkIdleTimeout: 100 });

                await pageLoader.load(resolveNow_);

                await clock.tickAsync(50);
                assert.neverCalledWith(pageLoader.emit, "networkResolved");
                await clock.tickAsync(100);
                assert.calledWith(pageLoader.emit, "networkResolved");
            });

            it("should emit 'networkResolved' on 'timeout' with warn log", async () => {
                const { pageLoader, mockStub } = mkPageLoader_({ timeout: 100 });

                await pageLoader.load(resolveNow_);
                mockStub.emit("request");

                await clock.tickAsync(100);
                assert.calledWith(pageLoader.emit, "networkResolved");
                assert.calledOnceWith(loggerStub.warn, "PageLoader: Network idle timeout");
            });
        });
    });
});
