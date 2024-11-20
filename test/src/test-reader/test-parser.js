"use strict";

const { TreeBuilder } = require("src/test-reader/tree-builder");
const { InstructionsList, Instructions } = require("src/test-reader/build-instructions");
const { SkipController } = require("src/test-reader/controllers/skip-controller");
const { OnlyController } = require("src/test-reader/controllers/only-controller");
const { AlsoController } = require("src/test-reader/controllers/also-controller");
const { ConfigController } = require("src/test-reader/controllers/config-controller");
const { TestParserAPI } = require("src/test-reader/test-parser-api");
const { Test, Suite } = require("src/test-reader/test-object");
const { MasterEvents: RunnerEvents, TestReaderEvents } = require("src/events");
const { makeConfigStub } = require("../../utils");
const proxyquire = require("proxyquire").noCallThru();
const path = require("path");
const { EventEmitter } = require("events");
const _ = require("lodash");
const fs = require("fs-extra");

const { NEW_BUILD_INSTRUCTION } = TestReaderEvents;

describe("test-reader/test-parser", () => {
    const sandbox = sinon.createSandbox();

    let TestParser;
    let clearRequire;
    let readFiles;
    let setupTransformHook;
    let browserVersionController = {
        mkProvider: sinon.stub().returns(() => {}),
    };

    beforeEach(() => {
        clearRequire = sandbox.stub().named("clear-require");
        readFiles = sandbox.stub().named("readFiles").resolves();
        setupTransformHook = sandbox.stub().named("setupTransformHook").returns(sinon.stub());

        TestParser = proxyquire("src/test-reader/test-parser", {
            "clear-require": clearRequire,
            "./mocha-reader": { readFiles },
            "./controllers/browser-version-controller": browserVersionController,
            "../bundle/test-transformer": { setupTransformHook },
        }).TestParser;

        sandbox.stub(fs, "readJSON").resolves([]);
        sandbox.stub(InstructionsList.prototype, "push").returnsThis();
        sandbox.stub(InstructionsList.prototype, "exec").returns(new Suite());
    });

    afterEach(() => {
        sandbox.restore();

        delete global.testplane;
    });

    describe("loadFiles", () => {
        const loadFiles_ = async ({ parser, files, config, runnableOpts } = {}) => {
            parser = parser || new TestParser();
            config = config || makeConfigStub();

            return parser.loadFiles(files || [], { config, runnableOpts });
        };

        describe("globals", () => {
            it("should create global testplane object", async () => {
                await loadFiles_();

                assert.property(global, "testplane");
            });

            describe("testplane.ctx", () => {
                it("should set testplane.ctx", async () => {
                    const config = makeConfigStub({
                        system: {
                            ctx: { foo: "bar" },
                        },
                    });

                    await loadFiles_({ config });

                    assert.deepEqual(global.testplane.ctx, { foo: "bar" });
                });

                it("should set testplane.ctx before loading files", async () => {
                    const config = makeConfigStub({
                        system: {
                            ctx: { foo: "bar" },
                        },
                    });

                    let ctx;
                    readFiles.callsFake(() => (ctx = global.testplane.ctx));

                    await loadFiles_({ config });

                    assert.deepEqual(ctx, { foo: "bar" });
                });
            });
            ``;

            describe("testplane.browser", () => {
                beforeEach(() => {
                    // sandbox.stub(browserVersionController, "mkProvider").get(() => {});
                });

                it("should set controller provider", async () => {
                    const provider = () => {};
                    browserVersionController.mkProvider.returns(provider);

                    await loadFiles_();

                    assert.equal(global.testplane.browser, provider);
                });

                it("should set controller provider before loading files", async () => {
                    await loadFiles_();

                    assert.callOrder(browserVersionController.mkProvider, readFiles);
                });

                it("should create controller provider with list of known browsers", async () => {
                    const config = makeConfigStub({ browsers: ["foo", "bar"] });

                    await loadFiles_({ config });

                    assert.calledWith(browserVersionController.mkProvider, ["foo", "bar"]);
                });

                it("should create controller with event bus", async () => {
                    await loadFiles_();

                    assert.calledWith(
                        browserVersionController.mkProvider,
                        sinon.match.any,
                        sinon.match.instanceOf(EventEmitter),
                    );
                });
            });

            Object.entries({
                skip: SkipController,
                only: OnlyController,
                also: AlsoController,
            }).forEach(([controllerName, controllerClass]) => {
                describe(`hermions.${controllerName}`, () => {
                    beforeEach(() => {
                        sandbox.spy(controllerClass, "create");
                    });

                    it(`should set testplane.${controllerName}`, async () => {
                        await loadFiles_();

                        assert.instanceOf(global.testplane[controllerName], controllerClass);
                    });

                    it(`should set testplane.${controllerName} before loading files`, async () => {
                        await loadFiles_();

                        assert.callOrder(controllerClass.create, readFiles);
                    });

                    it("should create controller with event bus", async () => {
                        await loadFiles_();

                        assert.calledWith(controllerClass.create, sinon.match.instanceOf(EventEmitter));
                    });
                });
            });

            describe("testplane.config", () => {
                beforeEach(() => {
                    sandbox.stub(ConfigController, "create").returns(Object.create(ConfigController.prototype));
                });

                it("should set testplane.config", async () => {
                    await loadFiles_();

                    assert.instanceOf(global.testplane.config, ConfigController);
                });

                it("should set testplane.config before loading files", async () => {
                    await loadFiles_();

                    assert.callOrder(ConfigController.create, readFiles);
                });

                it("should create controller with event bus", async () => {
                    await loadFiles_();

                    assert.calledWith(ConfigController.create, sinon.match.instanceOf(EventEmitter));
                });
            });
        });

        describe("events", () => {
            describe("on NEW_BUILD_INSTRUCTION", () => {
                it("should push build instruction", async () => {
                    const instruction = sinon.spy();
                    readFiles.callsFake((files, { eventBus }) => {
                        eventBus.emit(NEW_BUILD_INSTRUCTION, instruction);
                    });

                    await loadFiles_();

                    assert.calledWith(InstructionsList.prototype.push, instruction, undefined);
                });

                it("after BEFORE_FILE_READ should push instruction with current file", async () => {
                    const instruction = sinon.spy();
                    readFiles.callsFake((files, { eventBus }) => {
                        eventBus.emit(RunnerEvents.BEFORE_FILE_READ, { file: "/foo/bar.js" });
                        eventBus.emit(NEW_BUILD_INSTRUCTION, instruction);
                    });

                    await loadFiles_();

                    assert.calledWith(InstructionsList.prototype.push, instruction, "/foo/bar.js");
                });

                it("after AFTER_FILE_READ should push instruction with no file", async () => {
                    const instruction = sinon.spy();
                    readFiles.callsFake((files, { eventBus }) => {
                        eventBus.emit(RunnerEvents.BEFORE_FILE_READ, { file: "/foo/bar.js" });
                        eventBus.emit(RunnerEvents.AFTER_FILE_READ, {});
                        eventBus.emit(NEW_BUILD_INSTRUCTION, instruction);
                    });

                    await loadFiles_();

                    assert.calledWith(InstructionsList.prototype.push, instruction, undefined);
                });
            });

            ["BEFORE_FILE_READ", "AFTER_FILE_READ"].forEach(eventName => {
                describe(`on ${eventName}`, () => {
                    beforeEach(() => {
                        sandbox.spy(TestParserAPI, "create");
                    });

                    const init_ = ({ eventData } = {}) => {
                        const onEvent = sinon.stub().named(`on${eventName}`);
                        const parser = new TestParser().on(RunnerEvents[eventName], onEvent);

                        readFiles.callsFake((files, { eventBus }) => {
                            eventBus.emit(RunnerEvents[eventName], eventData || { some: "default-data" });
                        });

                        return {
                            onEvent,
                            parser,
                            loadFiles: () => loadFiles_({ parser }),
                        };
                    };

                    it(`should passthrough ${eventName} event`, async () => {
                        const eventData = { file: "foo/bar.js" };
                        const { onEvent, loadFiles } = init_({ eventData });

                        await loadFiles();

                        assert.calledOnceWith(onEvent, sinon.match(eventData));
                    });

                    it(`should extend ${eventName} event data with testplane object`, async () => {
                        const { onEvent, loadFiles } = init_();

                        await loadFiles();

                        assert.calledOnceWith(
                            onEvent,
                            sinon.match({
                                testplane: global.testplane,
                            }),
                        );
                    });

                    if (eventName === "BEFORE_FILE_READ") {
                        it("should create test parser API object", async () => {
                            await loadFiles_();

                            assert.calledOnceWith(
                                TestParserAPI.create,
                                global.testplane,
                                sinon.match.instanceOf(EventEmitter),
                            );
                        });

                        it(`should extend ${eventName} event with test parser API`, async () => {
                            const { onEvent, loadFiles } = init_();

                            await loadFiles();

                            assert.calledOnceWith(
                                onEvent,
                                sinon.match({
                                    testParser: sinon.match.instanceOf(TestParserAPI),
                                }),
                            );
                        });
                    }
                });
            });
        });

        describe("file cache", () => {
            it("should pass files to mocha reader as is", async () => {
                await loadFiles_({ files: ["foo/bar.js", "baz/qux.mjs"] });

                assert.calledWith(readFiles, ["foo/bar.js", "baz/qux.mjs"]);
            });

            it("should clear require cache for commonjs file before reading", async () => {
                await loadFiles_({ files: ["foo/bar.js"] });

                assert.calledOnceWith(clearRequire, path.resolve("foo/bar.js"));
                assert.callOrder(clearRequire, readFiles);
            });

            it("should not clear require cache for ESM files", async () => {
                await loadFiles_({ files: ["foo/bar.mjs"] });

                assert.notCalled(clearRequire);
            });
        });

        describe("failed tests", () => {
            it("should read if config.lastFailed.only is set", async () => {
                const config = makeConfigStub({
                    lastFailed: {
                        only: true,
                        input: "file.json",
                    },
                });

                await loadFiles_({ config });

                assert.calledWith(fs.readJSON, "file.json");
            });

            it("should read from one file if config.lastFailed.input is a string", async () => {
                const config = makeConfigStub({
                    lastFailed: {
                        only: true,
                        input: "failed.json",
                    },
                });

                await loadFiles_({ config });

                assert.calledWith(fs.readJSON, "failed.json");
            });

            it("should read from multiple files if config.lastFailed.input is a string with commas", async () => {
                const config = makeConfigStub({
                    lastFailed: {
                        only: true,
                        input: "failed.json, failed2.json",
                    },
                });

                await loadFiles_({ config });

                assert.calledWith(fs.readJSON, "failed.json");
                assert.calledWith(fs.readJSON, "failed2.json");
            });

            it("should read from multiple files if config.lastFailed.input is an array", async () => {
                const config = makeConfigStub({
                    lastFailed: {
                        only: true,
                        input: ["failed.json", "failed2.json"],
                    },
                });

                await loadFiles_({ config });

                assert.calledWith(fs.readJSON, "failed.json");
                assert.calledWith(fs.readJSON, "failed2.json");
            });

            it("should not read if config.lastFailed.only is not set", async () => {
                await loadFiles_();

                assert.notCalled(fs.readJSON);
            });
        });

        describe("read files", () => {
            it("should read passed files", async () => {
                const files = ["foo/bar", "baz/qux"];

                await loadFiles_({ files });

                assert.calledOnceWith(readFiles, files);
            });

            it("should pass mocha opts to reader", async () => {
                const config = makeConfigStub({
                    system: {
                        mochaOpts: {
                            foo: "bar",
                        },
                    },
                });

                await loadFiles_({ config });

                assert.calledWithMatch(readFiles, sinon.match.any, { config: { foo: "bar" } });
            });

            it("should pass event bus to reader", async () => {
                await loadFiles_();

                assert.calledWithMatch(readFiles, sinon.match.any, { eventBus: sinon.match.instanceOf(EventEmitter) });
            });

            it("should pass runnable options to reader", async () => {
                const runnableOpts = { saveLocations: true };

                await loadFiles_({ runnableOpts });

                assert.calledWithMatch(readFiles, sinon.match.any, { runnableOpts });
            });

            describe("esm decorator", () => {
                it("should be passed to mocha reader", async () => {
                    await loadFiles_();

                    assert.calledWithMatch(readFiles, sinon.match.any, { esmDecorator: sinon.match.func });
                });

                it("should decorate esm module name with some random", async () => {
                    await loadFiles_();

                    const { esmDecorator } = readFiles.lastCall.args[1];
                    assert.match(esmDecorator("/some/file.mjs"), /^\/some\/file\.mjs\?rand=0\.[0-9]+$/);
                });

                it("should decorate with different random between calls", async () => {
                    await loadFiles_();
                    await loadFiles_();

                    const file = "/some/file.mjs";
                    const firstCallModuleName = readFiles.firstCall.args[1].esmDecorator(file);
                    const lastCallModuleName = readFiles.lastCall.args[1].esmDecorator(file);

                    assert.notEqual(firstCallModuleName, lastCallModuleName);
                });
            });

            describe("transform hook", () => {
                describe("removeNonJsImports", () => {
                    [
                        { removeNonJsImports: true, testRunEnv: "browser" },
                        { removeNonJsImports: false, testRunEnv: "nodejs" },
                    ].forEach(({ removeNonJsImports, testRunEnv }) => {
                        it(`should be "${removeNonJsImports}" if testRunEnv is "${testRunEnv}"`, async () => {
                            const parser = new TestParser({ testRunEnv });

                            await loadFiles_({ parser, files: ["foo/bar", "baz/qux"] });

                            assert.calledOnceWith(setupTransformHook, { removeNonJsImports });
                        });
                    });
                });

                it("should setup hook before read files", async () => {
                    await loadFiles_({ files: ["foo/bar", "baz/qux"] });

                    assert.callOrder(setupTransformHook, readFiles);
                });

                it("should call revert transformation after read files", async () => {
                    const revertFn = sinon.stub();
                    setupTransformHook.returns(revertFn);

                    await loadFiles_({ files: ["foo/bar", "baz/qux"] });

                    assert.callOrder(readFiles, revertFn);
                });
            });
        });

        describe("root suite decorators", () => {
            [
                Instructions.extendWithBrowserId,
                Instructions.extendWithBrowserVersion,
                Instructions.extendWithTimeout,
            ].forEach(instruction => {
                describe(`${instruction.name} build instruction`, () => {
                    it("should be added once", async () => {
                        await loadFiles_();

                        assert.calledWith(InstructionsList.prototype.push, instruction);
                        assert(InstructionsList.prototype.push.withArgs(instruction).calledOnce, "too many calls");
                    });

                    it("should be added before reading files", async () => {
                        await loadFiles_();

                        assert(
                            InstructionsList.prototype.push.withArgs(instruction).calledBefore(readFiles),
                            "wrong order",
                        );
                    });
                });
            });

            describe("global skip instruction", () => {
                beforeEach(() => {
                    sandbox.stub(Instructions, "buildGlobalSkipInstruction");
                });

                it("should build global skip instruction", async () => {
                    const config = makeConfigStub();

                    await loadFiles_({ config });

                    assert.calledOnceWith(Instructions.buildGlobalSkipInstruction, config);
                });

                it("should add built global skip instruction", async () => {
                    const globalSkipInstruction = sinon.spy();
                    Instructions.buildGlobalSkipInstruction.returns(globalSkipInstruction);

                    await loadFiles_();

                    assert.calledWith(InstructionsList.prototype.push, globalSkipInstruction);
                    assert(
                        InstructionsList.prototype.push.withArgs(globalSkipInstruction).calledOnce,
                        "too many calls",
                    );
                });

                it("should add global skip instruction before reading files", async () => {
                    const globalSkipInstruction = sinon.spy();
                    Instructions.buildGlobalSkipInstruction.returns(globalSkipInstruction);

                    await loadFiles_();

                    assert(
                        InstructionsList.prototype.push.withArgs(globalSkipInstruction).calledBefore(readFiles),
                        "wrong order",
                    );
                });
            });
        });
    });

    describe("parse", () => {
        const parse_ = async ({ files, browserId, config, grep } = {}, loadFilesConfig) => {
            loadFilesConfig = loadFilesConfig || makeConfigStub();
            config = _.defaults(config, {
                desiredCapabilities: {},
            });

            const parser = new TestParser();
            await parser.loadFiles([], { config: loadFilesConfig });

            return parser.parse(files || [], { browserId, config, grep });
        };

        beforeEach(() => {
            sandbox.stub(TreeBuilder.prototype, "addTestFilter");
            sandbox.stub(TreeBuilder.prototype, "applyFilters").returnsThis();
            sandbox.stub(TreeBuilder.prototype, "getRootSuite").returns(new Suite({}));

            sandbox.stub(Suite.prototype, "getTests").returns([]);
        });

        describe("addTestFilter", () => {
            it("should not call if config.lastFailed.only is not set", async () => {
                await parse_();

                assert.notCalled(TreeBuilder.prototype.addTestFilter);
            });

            it("should call addTestFilter if config.lastFailed.only is set", async () => {
                const tests = [
                    new Test({
                        title: "title",
                        browserId: "chrome",
                        browserVersion: "1",
                    }),
                    new Test({
                        title: "title2",
                        browserId: "chrome",
                        browserVersion: "1",
                    }),
                ];

                fs.readJSON.resolves([
                    {
                        fullTitle: tests[0].fullTitle(),
                        browserId: tests[0].browserId,
                        browserVersion: tests[0].browserVersion,
                    },
                ]);

                const config = makeConfigStub({
                    lastFailed: {
                        only: true,
                        input: "failed.json",
                    },
                });

                await parse_({ config }, config);

                const filter = TreeBuilder.prototype.addTestFilter.lastCall.args[0];

                assert.equal(filter(tests[0]), true);
                assert.equal(filter(tests[1]), false);
            });
        });

        it("should execute build instructions", async () => {
            await parse_();

            assert.calledOnce(InstructionsList.prototype.exec);
        });

        it("should execute build instructions for passed files", async () => {
            const files = ["file1", "file2"];

            await parse_({ files });

            assert.calledWith(InstructionsList.prototype.exec, files);
        });

        it("should execute build instructions with passed browserId", async () => {
            await parse_({ browserId: "bro" });

            assert.calledWithMatch(InstructionsList.prototype.exec, sinon.match.any, { browserId: "bro" });
        });

        it("should execute build instructions with passed config", async () => {
            const config = { foo: "bar" };

            await parse_({ config });

            assert.calledWithMatch(InstructionsList.prototype.exec, sinon.match.any, { config });
        });

        it("should execute build instructions with tree builder", async () => {
            await parse_();

            assert.calledWithMatch(InstructionsList.prototype.exec, sinon.match.any, {
                treeBuilder: sinon.match.instanceOf(TreeBuilder),
            });
        });

        describe("grep", () => {
            it("should not set test filter to tree builder if grep not set", async () => {
                await parse_();

                assert.notCalled(TreeBuilder.prototype.addTestFilter);
            });

            describe("if set", () => {
                it("should set test filter to tree builder", async () => {
                    await parse_({ grep: /.*/ });

                    assert.calledOnceWith(TreeBuilder.prototype.addTestFilter, sinon.match.func);
                });

                it("should set test filter to tree builder before applying filters", async () => {
                    await parse_({ grep: /.*/ });

                    assert.callOrder(TreeBuilder.prototype.addTestFilter, TreeBuilder.prototype.applyFilters);
                });

                it("installed filter should accept matched test", async () => {
                    await parse_({ grep: /fooBar/ });

                    const filter = TreeBuilder.prototype.addTestFilter.lastCall.args[0];
                    const test = { fullTitle: () => "baz fooBar qux" };

                    assert.isTrue(filter(test));
                });

                it("installed filter should ignore not matched test", async () => {
                    await parse_({ grep: /fooBar/ });

                    const filter = TreeBuilder.prototype.addTestFilter.lastCall.args[0];
                    const test = { fullTitle: () => "baz qux" };

                    assert.isFalse(filter(test));
                });
            });
        });

        it("should apply filters on tree builder", async () => {
            await parse_();

            assert.calledOnce(TreeBuilder.prototype.applyFilters);
        });

        it("should apply filters after instructions execution but before getting root suite", async () => {
            await parse_();

            assert.callOrder(
                InstructionsList.prototype.exec,
                TreeBuilder.prototype.applyFilters,
                TreeBuilder.prototype.getRootSuite,
            );
        });

        it("should return tree tests", async () => {
            const tests = [new Test({ file: "foo/bar.js" })];
            Suite.prototype.getTests.returns(tests);

            const res = await parse_();

            assert.deepEqual(res, tests);
        });

        describe("in case of duplicate test titles", () => {
            it("should reject for tests in the same file", async () => {
                Suite.prototype.getTests.returns([
                    new Test({ title: "some test", file: "foo/bar.js" }),
                    new Test({ title: "some test", file: "foo/bar.js" }),
                ]);

                await assert.isRejected(parse_(), "same title");
            });

            it("should reject for tests in different files", async () => {
                Suite.prototype.getTests.returns([
                    new Test({ title: "some test", file: "foo/bar.js" }),
                    new Test({ title: "some test", file: "baz/qux.js" }),
                ]);

                await assert.isRejected(parse_(), "same title");
            });
        });
    });
});
