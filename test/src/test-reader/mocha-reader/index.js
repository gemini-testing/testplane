"use strict";

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
    const sandbox = sinon.sandbox.create();

    let MochaConstructorStub;
    let readFiles;

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

        readFiles = proxyquire("src/test-reader/mocha-reader", {
            mocha: MochaConstructorStub,
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
            ].forEach(([mochaEvent, hermioneEvent]) => {
                it(`should emit ${hermioneEvent} on mocha ${mochaEvent}`, async () => {
                    const onEvent = sinon.stub().named(`on${hermioneEvent}`);
                    const eventBus = new EventEmitter().on(RunnerEvents[hermioneEvent], onEvent);

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
