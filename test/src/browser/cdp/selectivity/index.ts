import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";
import type { ExistingBrowser } from "src/browser/existing-browser";
import type { Test } from "src/types";

describe("CDP/Selectivity", () => {
    const sandbox = sinon.createSandbox();
    let startSelectivity: typeof import("src/browser/cdp/selectivity/index").startSelectivity;
    let CSSSelectivityStub: SinonStub;
    let JSSelectivityStub: SinonStub;
    let getTestDependenciesWriterStub: SinonStub;
    let getFileHashWriterStub: SinonStub;
    let transformSourceDependenciesStub: SinonStub;
    let cssSelectivityMock: { start: SinonStub; stop: SinonStub };
    let jsSelectivityMock: { start: SinonStub; stop: SinonStub };
    let testDependenciesWriterMock: { saveFor: SinonStub };
    let fileHashWriterMock: { add: SinonStub; commit: SinonStub };
    let browserMock: {
        config: {
            selectivity: {
                enabled: boolean;
                sourceRoot: string;
                testDependenciesPath: string;
            };
        };
        publicAPI: { isChromium: boolean; getWindowHandle: SinonStub };
        cdp: {
            target: { getTargets: SinonStub; attachToTarget: SinonStub; detachFromTarget: SinonStub };
        } | null;
    };

    beforeEach(() => {
        cssSelectivityMock = {
            start: sandbox.stub().resolves(),
            stop: sandbox.stub().resolves(["src/styles.css"]),
        };
        jsSelectivityMock = {
            start: sandbox.stub().resolves(),
            stop: sandbox.stub().resolves(["src/app.js"]),
        };
        testDependenciesWriterMock = {
            saveFor: sandbox.stub().resolves(),
        };
        fileHashWriterMock = {
            add: sandbox.stub(),
            commit: sandbox.stub().resolves(),
        };

        CSSSelectivityStub = sandbox.stub().returns(cssSelectivityMock);
        JSSelectivityStub = sandbox.stub().returns(jsSelectivityMock);
        getTestDependenciesWriterStub = sandbox.stub().returns(testDependenciesWriterMock);
        getFileHashWriterStub = sandbox.stub().returns(fileHashWriterMock);
        transformSourceDependenciesStub = sandbox.stub().returns({
            css: ["src/styles.css"],
            js: ["src/app.js"],
            modules: ["node_modules/react"],
        });

        browserMock = {
            config: {
                selectivity: {
                    enabled: true,
                    sourceRoot: "/test/source-root",
                    testDependenciesPath: "/test/dependencies",
                },
            },
            publicAPI: {
                isChromium: true,
                getWindowHandle: sandbox.stub().resolves("CDwindow-target-123"),
            },
            cdp: {
                target: {
                    getTargets: sandbox.stub().resolves({
                        targetInfos: [{ targetId: "target-123" }],
                    }),
                    attachToTarget: sandbox.stub().resolves({ sessionId: "session-123" }),
                    detachFromTarget: sandbox.stub().resolves(),
                },
            },
        };

        startSelectivity = proxyquire("src/browser/cdp/selectivity/index", {
            "./css-selectivity": { CSSSelectivity: CSSSelectivityStub },
            "./js-selectivity": { JSSelectivity: JSSelectivityStub },
            "./test-dependencies-writer": { getTestDependenciesWriter: getTestDependenciesWriterStub },
            "./file-hash-writer": { getFileHashWriter: getFileHashWriterStub },
            "./utils": { transformSourceDependencies: transformSourceDependenciesStub },
        }).startSelectivity;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("startSelectivity", () => {
        it("should return no-op function if selectivity is disabled", async () => {
            browserMock.config.selectivity.enabled = false;

            const stopFn = await startSelectivity(browserMock as unknown as ExistingBrowser);

            assert.isFunction(stopFn);

            await stopFn({ id: "test", browserId: "chrome" } as Test, true);

            assert.notCalled(CSSSelectivityStub);
            assert.notCalled(JSSelectivityStub);
        });

        it("should return no-op function if browser is not Chromium", async () => {
            browserMock.publicAPI.isChromium = false;

            const stopFn = await startSelectivity(browserMock as unknown as ExistingBrowser);

            assert.isFunction(stopFn);

            await stopFn({ id: "test", browserId: "chrome" } as Test, true);

            assert.notCalled(CSSSelectivityStub);
            assert.notCalled(JSSelectivityStub);
        });

        it("should throw error if CDP connection is not established", async () => {
            browserMock.cdp = null;

            await assert.isRejected(
                startSelectivity(browserMock as unknown as ExistingBrowser),
                /Selectivity: Devtools connection is not established, couldn't record selectivity without it/,
            );
        });

        it("should throw error if target ID is not found", async () => {
            browserMock.publicAPI.getWindowHandle.resolves("unknown-handle");
            browserMock.cdp!.target.getTargets.resolves({
                targetInfos: [{ targetId: "different-target" }],
            });

            await assert.isRejected(
                startSelectivity(browserMock as unknown as ExistingBrowser),
                /Selectivity: Couldn't find current page/,
            );
        });

        it("should start CSS and JS selectivity and return stop function", async () => {
            const stopFn = await startSelectivity(browserMock as unknown as ExistingBrowser);

            assert.calledWith(browserMock.cdp!.target.getTargets);
            assert.calledWith(browserMock.cdp!.target.attachToTarget, "target-123");
            assert.calledWith(CSSSelectivityStub, browserMock.cdp, "session-123", "/test/source-root");
            assert.calledWith(JSSelectivityStub, browserMock.cdp, "session-123", "/test/source-root");
            assert.calledOnce(cssSelectivityMock.start);
            assert.calledOnce(jsSelectivityMock.start);
            assert.isFunction(stopFn);
        });

        it("should handle window handle containing target ID", async () => {
            browserMock.publicAPI.getWindowHandle.resolves("CDwindow-target-123-suffix");
            browserMock.cdp!.target.getTargets.resolves({
                targetInfos: [{ targetId: "target-123" }],
            });

            const stopFn = await startSelectivity(browserMock as unknown as ExistingBrowser);

            assert.isFunction(stopFn);
            assert.calledWith(browserMock.cdp!.target.attachToTarget, "target-123");
        });
    });

    describe("stopSelectivity", () => {
        let stopFn: any;
        const mockTest = { id: "test-123", browserId: "chrome" };

        beforeEach(async () => {
            stopFn = await startSelectivity(browserMock as unknown as ExistingBrowser);
        });

        it("should stop selectivity and not save when shouldWrite is false", async () => {
            await stopFn(mockTest, false);

            assert.calledWith(cssSelectivityMock.stop, true);
            assert.calledWith(jsSelectivityMock.stop, true);
            assert.calledWith(browserMock.cdp!.target.detachFromTarget, "session-123");
            assert.notCalled(testDependenciesWriterMock.saveFor);
            assert.notCalled(fileHashWriterMock.add);
            assert.notCalled(fileHashWriterMock.commit);
        });

        it("should stop selectivity and save dependencies when shouldWrite is true", async () => {
            await stopFn(mockTest, true);

            assert.calledWith(cssSelectivityMock.stop, false);
            assert.calledWith(jsSelectivityMock.stop, false);
            assert.calledWith(transformSourceDependenciesStub, ["src/styles.css"], ["src/app.js"]);
            assert.calledWith(getTestDependenciesWriterStub, "/test/dependencies");
            assert.calledWith(getFileHashWriterStub, "/test/dependencies");
            assert.calledWith(fileHashWriterMock.add, {
                css: ["src/styles.css"],
                js: ["src/app.js"],
                modules: ["node_modules/react"],
            });
            assert.calledWith(testDependenciesWriterMock.saveFor, mockTest, {
                css: ["src/styles.css"],
                js: ["src/app.js"],
                modules: ["node_modules/react"],
            });
            assert.calledOnce(fileHashWriterMock.commit);
        });

        it("should not save when no dependencies are found", async () => {
            cssSelectivityMock.stop.resolves([]);
            jsSelectivityMock.stop.resolves([]);

            await stopFn(mockTest, true);

            assert.notCalled(testDependenciesWriterMock.saveFor);
            assert.notCalled(fileHashWriterMock.add);
            assert.notCalled(fileHashWriterMock.commit);
        });

        it("should handle CDP detach errors gracefully", async () => {
            browserMock.cdp!.target.detachFromTarget.rejects(new Error("Detach failed"));

            await stopFn(mockTest, false);

            assert.calledWith(browserMock.cdp!.target.detachFromTarget, "session-123");
        });

        it("should handle CSS selectivity errors", async () => {
            cssSelectivityMock.stop.rejects(new Error("CSS error"));

            await assert.isRejected(stopFn(mockTest, true), "CSS error");
        });

        it("should handle JS selectivity errors", async () => {
            jsSelectivityMock.stop.rejects(new Error("JS error"));

            await assert.isRejected(stopFn(mockTest, true), "JS error");
        });

        it("should handle test dependencies writer errors", async () => {
            testDependenciesWriterMock.saveFor.rejects(new Error("Save error"));

            await assert.isRejected(stopFn(mockTest, true), "Save error");
        });

        it("should handle file hash writer errors", async () => {
            fileHashWriterMock.commit.rejects(new Error("Commit error"));

            await assert.isRejected(stopFn(mockTest, true), "Commit error");
        });

        it("should save dependencies when only CSS dependencies exist", async () => {
            jsSelectivityMock.stop.resolves([]);

            await stopFn(mockTest, true);

            assert.calledWith(transformSourceDependenciesStub, ["src/styles.css"], []);
            assert.calledOnce(testDependenciesWriterMock.saveFor);
            assert.calledOnce(fileHashWriterMock.add);
            assert.calledOnce(fileHashWriterMock.commit);
        });

        it("should save dependencies when only JS dependencies exist", async () => {
            cssSelectivityMock.stop.resolves([]);

            await stopFn(mockTest, true);

            assert.calledWith(transformSourceDependenciesStub, [], ["src/app.js"]);
            assert.calledOnce(testDependenciesWriterMock.saveFor);
            assert.calledOnce(fileHashWriterMock.add);
            assert.calledOnce(fileHashWriterMock.commit);
        });
    });
});
