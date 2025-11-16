"use strict";

const _ = require("lodash");
const { MochaEventBus } = require("src/test-reader/mocha-reader/mocha-event-bus");
const { TreeBuilderDecorator } = require("src/test-reader/mocha-reader/tree-builder-decorator");
const { TreeBuilder } = require("src/test-reader/tree-builder");
const { Test } = require("src/test-reader/test-object");
const { TestReaderEvents: ReadEvents } = require("src/events");
const { MasterEvents: RunnerEvents } = require("src/events");
const Mocha = require("mocha");
const proxyquire = require("proxyquire").noCallThru();
const { EventEmitter } = require("events");

describe("test-reader/mocha-reader", () => {
    const sandbox = sinon.createSandbox();

    let MochaConstructorStub;
    let SourceMapSupportStub;
    let getMethodsByInterfaceStub;
    let enableSourceMapsStub;
    let readFiles;
    let loggerWarnStub;

    const mkMochaSuiteStub_ = () => {
        const suite = Object.create(Mocha.Suite.prototype);
        suite.title = "some default mocha suite";
        suite.id = "some-default-id";
        suite.timeout = sinon.stub().named("timeout").returns(0);

        return suite;
    };

    const mkMochaStub_ = () => {
        const mocha = Object.create(Mocha.prototype);
        mocha.suite = mkMochaSuiteStub_();

        return mocha;
    };

    beforeEach(() => {
        MochaConstructorStub = sinon.stub().returns(mkMochaStub_());
        MochaConstructorStub.Suite = Mocha.Suite;

        SourceMapSupportStub = {
            wrapCallSite: sinon.stub().returns({
                getLineNumber: () => 1,
                getColumnNumber: () => 1,
            }),
            install: sinon.stub(),
        };
        getMethodsByInterfaceStub = sinon.stub().returns({ suiteMethods: [], testMethods: [] });
        enableSourceMapsStub = sinon.stub();

        loggerWarnStub = sinon.stub();

        readFiles = proxyquire("src/test-reader/mocha-reader", {
            mocha: MochaConstructorStub,
            "@cspotcode/source-map-support": SourceMapSupportStub,
            "./utils": { getMethodsByInterface: getMethodsByInterfaceStub },
            "../../utils/typescript": { enableSourceMaps: enableSourceMapsStub },
            "../../utils/logger": { warn: loggerWarnStub },
        }).readFiles;

        sandbox.stub(MochaEventBus, "create").returns(Object.create(MochaEventBus.prototype));

        sandbox.stub(Mocha.prototype, "fullTrace");
        sandbox.stub(Mocha.prototype, "addFile");
        sandbox.stub(Mocha.prototype, "loadFilesAsync").resolves();

        sandbox.stub(Mocha.Suite.prototype, "hasOnly").returns(false);
        sandbox.stub(Mocha.Suite.prototype, "filterOnly");
        sandbox.stub(Mocha.Suite.prototype, "eachTest");
    });

    afterEach(() => {
        sandbox.restore();
    });

    const readFiles_ = (files, opts = {}) => {
        if (!(files instanceof Array)) {
            opts = files;
            files = [];
        }

        return readFiles(files, {
            esmDecorator: () => {},
            config: { system: {} },
            eventBus: new EventEmitter(),
            ...opts,
        });
    };

    describe("loadFiles", () => {
        describe("mocha initialization", () => {
            it("should create mocha parser with passed config", async () => {
                const config = { foo: "bar" };

                await readFiles_({ config });

                assert.calledOnce(MochaConstructorStub);
                assert.calledWithNew(MochaConstructorStub);
                assert.calledWith(MochaConstructorStub, { foo: "bar" });
            });

            it("should enable full stacktrace in mocha", async () => {
                await readFiles_();

                assert.calledOnce(Mocha.prototype.fullTrace);
            });
        });

        describe("build context initialization", () => {
            it("should add instruction to wrap treeBuilder", async () => {
                const treeBuilder = sinon.createStubInstance(TreeBuilder);
                const ctx = { treeBuilder };
                const eventBus = new EventEmitter().on(ReadEvents.NEW_BUILD_INSTRUCTION, instruction =>
                    instruction(ctx),
                );

                sandbox.spy(TreeBuilderDecorator, "create");
                sandbox.stub(TreeBuilderDecorator.prototype, "addSuite");

                await readFiles_({ eventBus });

                assert.calledOnceWith(TreeBuilderDecorator.create, treeBuilder);
                assert.instanceOf(ctx.treeBuilder, TreeBuilderDecorator);
            });
        });

        describe("mocha root suite", () => {
            it("should init mocha event bus with root suite", async () => {
                await readFiles_();

                assert.calledOnceWith(MochaEventBus.create, MochaConstructorStub.lastCall.returnValue.suite);
            });

            it("should emit build instruction for adding suite to tree builder", async () => {
                const treeBuilder = sinon.createStubInstance(TreeBuilderDecorator);
                const eventBus = new EventEmitter().on(ReadEvents.NEW_BUILD_INSTRUCTION, instruction =>
                    instruction({ treeBuilder }),
                );

                await readFiles_({ eventBus });

                assert.calledOnceWith(treeBuilder.addSuite, MochaConstructorStub.lastCall.returnValue.suite);
            });
        });

        describe("load files", () => {
            it("should add files", async () => {
                await readFiles_(["foo/bar.js", "baz/qux.mjs"]);

                assert.calledTwice(Mocha.prototype.addFile);
                assert.calledWith(Mocha.prototype.addFile, "foo/bar.js");
                assert.calledWith(Mocha.prototype.addFile, "baz/qux.mjs");
            });

            it("should load files after add", async () => {
                const calls = [];
                Mocha.prototype.addFile.callsFake(() => calls.push("addFile"));
                Mocha.prototype.loadFilesAsync.callsFake(() => calls.push("loadFilesAsync"));

                await readFiles_(["foo/bar.js", "baz/qux.mjs"]);

                assert.deepEqual(calls, ["addFile", "addFile", "loadFilesAsync"]);
            });

            it("should passthrough esmDecorator to mocha", async () => {
                const esmDecorator = sinon.spy();

                await readFiles_({ esmDecorator });

                assert.calledWith(Mocha.prototype.loadFilesAsync, { esmDecorator });
            });

            describe("handle errors", () => {
                it("should do nothing if error thrown in non-browser environment", async () => {
                    Mocha.prototype.loadFilesAsync.rejects(new Error("Some error"));

                    await assert.isRejected(readFiles_({ isBrowserEnv: false }), "Some error");
                    assert.notCalled(loggerWarnStub);
                });

                it("should do nothing if error is not a MODULE_NOT_FOUND error", async () => {
                    Mocha.prototype.loadFilesAsync.rejects(new Error("Some error"));

                    await assert.isRejected(readFiles_({ isBrowserEnv: true }), "Some error");
                    assert.notCalled(loggerWarnStub);
                });

                it("should do nothing if error message does not contain '?'", async () => {
                    const error = new Error("Cannot find module 'file.svg'");
                    error.code = "MODULE_NOT_FOUND";
                    Mocha.prototype.loadFilesAsync.rejects(error);

                    await assert.isRejected(readFiles_({ isBrowserEnv: true }), "Cannot find module 'file.svg'");
                    assert.notCalled(loggerWarnStub);
                });

                it("should warn if module not found with query parameter in browser environment", async () => {
                    const error = new Error("Cannot find module 'file.svg?react'");
                    error.code = "MODULE_NOT_FOUND";
                    Mocha.prototype.loadFilesAsync.rejects(error);

                    await assert.isRejected(readFiles_({ isBrowserEnv: true }), "Cannot find module 'file.svg?react'");
                    assert.calledOnceWith(
                        loggerWarnStub,
                        sinon.match(
                            "Failed to resolve module with query parameter: Cannot find module 'file.svg?react'.",
                        ),
                    );
                });
            });
        });

        describe("forbid suite hooks", () => {
            it('should throw in case of "before" hook', async () => {
                Mocha.prototype.loadFilesAsync.callsFake(() => {
                    MochaEventBus.create.lastCall.returnValue.emit(
                        MochaEventBus.events.EVENT_SUITE_ADD_HOOK_BEFORE_ALL,
                    );
                });

                const res = readFiles_();

                await assert.isRejected(res, "forbidden");
            });

            it('should throw in case of "after" hook', async () => {
                Mocha.prototype.loadFilesAsync.callsFake(() => {
                    MochaEventBus.create.lastCall.returnValue.emit(MochaEventBus.events.EVENT_SUITE_ADD_HOOK_AFTER_ALL);
                });

                const res = readFiles_();

                await assert.isRejected(res, "forbidden");
            });
        });

        describe("passthrough file events", () => {
            [
                ["EVENT_FILE_PRE_REQUIRE", "BEFORE_FILE_READ"],
                ["EVENT_FILE_POST_REQUIRE", "AFTER_FILE_READ"],
            ].forEach(([mochaEvent, testplaneEvent]) => {
                it(`should emit ${testplaneEvent} on mocha ${mochaEvent}`, async () => {
                    const onEvent = sinon.stub().named(`on${testplaneEvent}`);
                    const eventBus = new EventEmitter().on(RunnerEvents[testplaneEvent], onEvent);

                    Mocha.prototype.loadFilesAsync.callsFake(() => {
                        MochaEventBus.create.lastCall.returnValue.emit(
                            MochaEventBus.events[mochaEvent],
                            {},
                            "foo/bar.js",
                        );
                    });

                    await readFiles_({ eventBus });

                    assert.calledOnceWith(
                        onEvent,
                        sinon.match({
                            file: "foo/bar.js",
                        }),
                    );
                });
            });
        });

        describe("add locations to runnables", () => {
            const emitAddRunnable_ = (runnable, event) => {
                MochaEventBus.create.lastCall.returnValue.emit(MochaEventBus.events[event], runnable);
            };

            it("should do nothing if 'saveLocations' is not enabled", async () => {
                const globalCtx = {
                    describe: () => {},
                };

                Mocha.prototype.loadFilesAsync.callsFake(() => {
                    MochaEventBus.create.lastCall.returnValue.emit(
                        MochaEventBus.events.EVENT_FILE_PRE_REQUIRE,
                        globalCtx,
                    );
                });

                await readFiles_({ runnableOpts: { saveLocations: false } });
                globalCtx.describe();

                assert.notCalled(SourceMapSupportStub.wrapCallSite);
            });

            it("should not throw if source-map-support is not installed", async () => {
                readFiles = proxyquire("src/test-reader/mocha-reader", {
                    "@cspotcode/source-map-support": null,
                }).readFiles;

                const globalCtx = { describe: _.noop };

                Mocha.prototype.loadFilesAsync.callsFake(() => {
                    MochaEventBus.create.lastCall.returnValue.emit(
                        MochaEventBus.events.EVENT_FILE_PRE_REQUIRE,
                        globalCtx,
                    );
                });

                await readFiles_({ runnableOpts: { saveLocations: true } });

                assert.doesNotThrow(() => globalCtx.describe());
            });

            it("should enable testplane source maps before installing 'source-map-support'", async () => {
                await readFiles_({ config: { ui: "bdd" }, runnableOpts: { saveLocations: true } });

                assert.calledOnce(enableSourceMapsStub);
                assert.callOrder(enableSourceMapsStub, SourceMapSupportStub.install);
            });

            it("should set 'hookRequire' option on install source-map-support", async () => {
                await readFiles_({ config: { ui: "bdd" }, runnableOpts: { saveLocations: true } });

                assert.calledOnceWith(SourceMapSupportStub.install, { hookRequire: true });
            });

            ["describe", "describe.only", "describe.skip", "xdescribe"].forEach(methodName => {
                it(`should add location to suite using "${methodName}"`, async () => {
                    getMethodsByInterfaceStub.withArgs("bdd").returns({ suiteMethods: ["describe"], testMethods: [] });
                    const suite = {};
                    const globalCtx = _.set({}, methodName, () => emitAddRunnable_(suite, "EVENT_SUITE_ADD_SUITE"));

                    Mocha.prototype.loadFilesAsync.callsFake(() => {
                        MochaEventBus.create.lastCall.returnValue.emit(
                            MochaEventBus.events.EVENT_FILE_PRE_REQUIRE,
                            globalCtx,
                        );
                    });

                    SourceMapSupportStub.wrapCallSite.returns({
                        getLineNumber: () => 100,
                        getColumnNumber: () => 500,
                    });

                    await readFiles_({ config: { ui: "bdd" }, runnableOpts: { saveLocations: true } });
                    _.get(globalCtx, methodName)();

                    assert.deepEqual(suite, { location: { line: 100, column: 500 } });
                });
            });

            ["it", "it.only", "it.skip", "xit"].forEach(methodName => {
                it(`should add location to test using "${methodName}"`, async () => {
                    getMethodsByInterfaceStub.withArgs("bdd").returns({ suiteMethods: [], testMethods: ["it"] });
                    const test = {};
                    const globalCtx = _.set({}, methodName, () => emitAddRunnable_(test, "EVENT_SUITE_ADD_TEST"));

                    Mocha.prototype.loadFilesAsync.callsFake(() => {
                        MochaEventBus.create.lastCall.returnValue.emit(
                            MochaEventBus.events.EVENT_FILE_PRE_REQUIRE,
                            globalCtx,
                        );
                    });

                    SourceMapSupportStub.wrapCallSite.returns({
                        getLineNumber: () => 500,
                        getColumnNumber: () => 100,
                    });

                    await readFiles_({ config: { ui: "bdd" }, runnableOpts: { saveLocations: true } });
                    _.get(globalCtx, methodName)();

                    assert.deepEqual(test, { location: { line: 500, column: 100 } });
                });
            });

            it(`should add location to each runnable`, async () => {
                getMethodsByInterfaceStub.withArgs("bdd").returns({ suiteMethods: ["describe"], testMethods: ["it"] });
                const suite = {};
                const test = {};
                const globalCtx = {
                    describe: () => emitAddRunnable_(suite, "EVENT_SUITE_ADD_SUITE"),
                    it: () => emitAddRunnable_(test, "EVENT_SUITE_ADD_TEST"),
                };

                Mocha.prototype.loadFilesAsync.callsFake(() => {
                    MochaEventBus.create.lastCall.returnValue.emit(
                        MochaEventBus.events.EVENT_FILE_PRE_REQUIRE,
                        globalCtx,
                    );
                });

                SourceMapSupportStub.wrapCallSite
                    .onFirstCall()
                    .returns({
                        getLineNumber: () => 111,
                        getColumnNumber: () => 222,
                    })
                    .onSecondCall()
                    .returns({
                        getLineNumber: () => 333,
                        getColumnNumber: () => 444,
                    });

                await readFiles_({ config: { ui: "bdd" }, runnableOpts: { saveLocations: true } });
                globalCtx.describe();
                globalCtx.it();

                assert.deepEqual(suite, { location: { line: 111, column: 222 } });
                assert.deepEqual(test, { location: { line: 333, column: 444 } });
            });
        });

        describe("test objects", () => {
            [
                ["EVENT_SUITE_ADD_SUITE", "addSuite"],
                ["EVENT_SUITE_ADD_TEST", "addTest"],
                ["EVENT_SUITE_ADD_HOOK_BEFORE_EACH", "addBeforeEachHook"],
                ["EVENT_SUITE_ADD_HOOK_AFTER_EACH", "addAfterEachHook"],
            ].forEach(([event, handleMethod]) => {
                it(`on ${event} should emit build instruction`, async () => {
                    const onBuildInstruction = sinon.spy();
                    const eventBus = new EventEmitter().on(ReadEvents.NEW_BUILD_INSTRUCTION, onBuildInstruction);

                    Mocha.prototype.loadFilesAsync.callsFake(() => {
                        MochaEventBus.create.lastCall.returnValue.emit(MochaEventBus.events[event], {});
                    });

                    await readFiles_({ eventBus });

                    assert.calledWith(onBuildInstruction, sinon.match.func);
                });

                it("build instruction should add test object to tree builder", async () => {
                    const testObject = { title: "foo bar" };
                    const treeBuilder = sinon.createStubInstance(TreeBuilderDecorator);
                    const eventBus = new EventEmitter().on(ReadEvents.NEW_BUILD_INSTRUCTION, instruction =>
                        instruction({ treeBuilder }),
                    );

                    Mocha.prototype.loadFilesAsync.callsFake(() => {
                        MochaEventBus.create.lastCall.returnValue.emit(MochaEventBus.events[event], testObject);
                    });

                    await readFiles_({ eventBus });

                    assert.calledWith(treeBuilder[handleMethod], testObject);
                });
            });
        });

        describe(".only", () => {
            let treeBuilder;

            const initBus_ = () => {
                const eventBus = new EventEmitter().on(ReadEvents.NEW_BUILD_INSTRUCTION, instruction =>
                    instruction({ treeBuilder }),
                );

                return eventBus;
            };

            beforeEach(() => {
                treeBuilder = sinon.createStubInstance(TreeBuilderDecorator);
                Mocha.Suite.prototype.hasOnly.returns(true);
            });

            it("should do nothing if nothing marked with .only", async () => {
                const onBuildInstruction = sinon.spy();
                const eventBus = new EventEmitter();

                Mocha.Suite.prototype.hasOnly.returns(false);

                Mocha.prototype.loadFilesAsync.callsFake(() => {
                    eventBus.on(ReadEvents.NEW_BUILD_INSTRUCTION, onBuildInstruction);
                });

                await readFiles_({ eventBus });

                assert.notCalled(onBuildInstruction);
            });

            it("should add filter in case of .only subjects", async () => {
                const eventBus = initBus_();

                await readFiles_({ eventBus });

                assert.calledOnceWith(treeBuilder.addTestFilter, sinon.match.func);
            });

            it("mocha filterOnly should be called once for any number of filter fn call", async () => {
                const eventBus = initBus_();

                await readFiles_({ eventBus });
                const filter = treeBuilder.addTestFilter.lastCall.args[0];

                filter(Test.create({}));
                filter(Test.create({}));

                assert.calledOnce(Mocha.Suite.prototype.filterOnly);
            });

            it("filter fn should accept remaining tests", async () => {
                Mocha.Suite.prototype.eachTest.callsFake(cb => {
                    cb({ fullTitle: () => "foo bar" });
                });

                const eventBus = initBus_();
                await readFiles_({ eventBus });

                const filter = treeBuilder.addTestFilter.lastCall.args[0];

                assert.isTrue(filter(Test.create({ title: "foo bar" })));
            });

            it("filter fn should not accept inappropriate tests", async () => {
                Mocha.Suite.prototype.eachTest.callsFake(cb => {
                    cb({ fullTitle: () => "foo bar" });
                });

                const eventBus = initBus_();
                await readFiles_({ eventBus });

                const filter = treeBuilder.addTestFilter.lastCall.args[0];

                assert.isFalse(filter(Test.create({ title: "baz qux" })));
            });
        });
    });
});
