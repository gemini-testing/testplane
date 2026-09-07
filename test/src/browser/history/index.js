"use strict";

const webdriver = require("@testplane/webdriver");
const webdriverio = require("@testplane/webdriverio");
const proxyquire = require("proxyquire");
const { Callstack } = require("../../../../src/browser/history/callstack");
const { SAVE_HISTORY_MODE } = require("src/constants/config");
const { ProfilerRuntime } = require("src/profiler/runtime/runtime");
const { mkExistingBrowser_, mkSessionStub_, createBrowserConfig_ } = require("../utils");

describe("commands-history", () => {
    const sandbox = sinon.createSandbox();
    let initCommandHistory, runGroup, getBrowserCommands, getElementCommands;

    beforeEach(() => {
        getBrowserCommands = sandbox.stub().returns([]);
        getElementCommands = sandbox.stub().returns([]);

        ({ initCommandHistory, runGroup } = proxyquire("src/browser/history", {
            "./commands": { getBrowserCommands, getElementCommands },
        }));
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("initCommandHistory", () => {
        let browserConfig;

        beforeEach(() => {
            browserConfig = createBrowserConfig_().forBrowser();
        });

        it("should return an instance of callstack", () => {
            const session = mkSessionStub_();
            const { callstack } = initCommandHistory(session, browserConfig);

            assert.instanceOf(callstack, Callstack);
        });

        it('should wrap "addCommand" command', async () => {
            const session = mkSessionStub_();
            const { callstack } = initCommandHistory(session, browserConfig);

            session.addCommand("foo", (a1, a2) => Promise.resolve(a1, a2));

            await session.foo("arg1", "arg2");

            const [node] = callstack.release();

            assert.propertyVal(node, "n", "foo");
            assert.propertyVal(node, "s", "b");
            assert.notProperty(node, "o", 0);
            assert.deepPropertyVal(node, "a", ["arg1", "arg2"]);
        });

        it('should wrap "overwriteCommand" command', async () => {
            const session = mkSessionStub_();
            const { callstack } = initCommandHistory(session, browserConfig);

            session.overwriteCommand("url", (a1, a2) => Promise.resolve(a1, a2));

            await session.url("site.com");

            const [node] = callstack.release();

            assert.propertyVal(node, "n", "url");
            assert.propertyVal(node, "s", "b");
            assert.propertyVal(node, "o", true);
            assert.deepPropertyVal(node, "a", ["site.com"]);
        });

        it('should save context while wrapping for "addCommand"', async () => {
            const session = mkSessionStub_();

            initCommandHistory(session, browserConfig);
            session.addCommand("foo", function () {
                return this;
            });

            const resultContext = await session.foo();

            assert.equal(resultContext, session);
        });

        it('should save element context while wrapping for "addCommand" with elemScope: true', async () => {
            const session = mkSessionStub_();

            initCommandHistory(session, browserConfig);
            session.addCommand(
                "foo",
                function () {
                    return this;
                },
                true,
            );

            const elem = await session.$(".selector");
            const resultContext = elem.foo();

            assert.equal(resultContext, elem);
        });

        it('should save element context while wrapping for "overwriteCommand" with elemScope: true', async () => {
            const session = mkSessionStub_();

            initCommandHistory(session, browserConfig);
            session.addCommand("foo", () => {}, true);
            session.overwriteCommand(
                "foo",
                function () {
                    return this;
                },
                true,
            );

            const elem = await session.$(".selector");
            const resultContext = elem.foo();

            assert.equal(resultContext, elem);
        });

        it("should wrap browser commands", async () => {
            getBrowserCommands.returns(["url"]);

            const session = mkSessionStub_();
            const { callstack } = initCommandHistory(session, browserConfig);

            await session.url("site.com");
            await session.execute();

            const [urlNode] = callstack.release();

            assert.propertyVal(urlNode, "n", "url");
            assert.propertyVal(urlNode, "s", "b");
            assert.notProperty(urlNode, "o");
            assert.deepPropertyVal(urlNode, "c", []);
            assert.deepPropertyVal(urlNode, "a", ["site.com"]);
        });

        it("should wrap element commands", async () => {
            getElementCommands.returns(["click"]);

            const session = mkSessionStub_();
            const { callstack } = initCommandHistory(session, browserConfig);

            const element = await session.$();

            await element.click("arg1");

            const [clickNode] = callstack.release();

            assert.propertyVal(clickNode, "n", "click");
            assert.propertyVal(clickNode, "s", "e");
            assert.notProperty(clickNode, "o");
            assert.deepPropertyVal(clickNode, "c", []);
            assert.deepPropertyVal(clickNode, "a", ["arg1"]);
        });

        it("should profile safe command attributes without enabling command history", async () => {
            getBrowserCommands.returns(["pause", "url"]);
            const session = mkSessionStub_();
            session.pause = sinon.stub().resolves();
            const profiler = new ProfilerRuntime({ runId: "run", level: 3 });
            const config = { ...browserConfig, saveHistoryMode: SAVE_HISTORY_MODE.NONE };
            const { callstack } = initCommandHistory(session, config, profiler);

            session.addCommand("customCommand", () => Promise.resolve());
            await session.url("https://user:password@example.com/page?token=secret#fragment");
            await session.pause(500);
            await session.customCommand({ secret: "must-not-be-inspected" });
            profiler.stop();

            assert.deepEqual(callstack.release(), []);
            const commands = profiler.snapshot().operations.filter(operation => operation.kind === "browser.command");
            assert.deepInclude(commands.find(command => command.name === "url").attributes, {
                command: "url",
                url: "https://example.com/page",
                custom: false,
                overwritten: false,
            });
            assert.propertyVal(
                commands.find(command => command.name === "pause").attributes,
                "requestedDurationMs",
                500,
            );
            assert.deepInclude(commands.find(command => command.name === "customCommand").attributes, {
                command: "customCommand",
                custom: true,
                overwritten: false,
            });
            assert.match(
                commands.find(command => command.name === "customCommand").source.file,
                /test\/src\/browser\/history\/index\.js$/,
            );
            assert.notProperty(commands.find(command => command.name === "customCommand").source, "functionName");
            assert.notInclude(JSON.stringify(commands), "must-not-be-inspected");
        });

        it("should skip command profiling work below level 3", async () => {
            getBrowserCommands.returns(["url"]);
            const session = mkSessionStub_();
            const profiler = new ProfilerRuntime({ runId: "run", level: 2 });
            const withSpan = sandbox.spy(profiler, "withSpan");
            initCommandHistory(session, browserConfig, profiler);

            await session.url("https://example.com");
            profiler.stop();

            assert.notCalled(withSpan);
            assert.isEmpty(profiler.snapshot().operations.filter(operation => operation.kind === "browser.command"));
        });
    });

    describe("runGroup", () => {
        let fnStub, callstackStub;

        beforeEach(() => {
            fnStub = sandbox.stub();
            callstackStub = {
                enter: sandbox.stub(),
                leave: sandbox.stub(),
                markError: sandbox.stub(),
            };
        });

        it("should execute function, if callstack is not inited", () => {
            runGroup({ callstack: null, snapshotsPromiseRef: { current: Promise.resolve() } }, "foo", fnStub);

            assert.calledOnce(fnStub);
        });

        it("should execute function with callstack", () => {
            runGroup(
                {
                    callstack: callstackStub,
                    config: { record: {} },
                    session: {},
                    snapshotsPromiseRef: { current: Promise.resolve() },
                },
                "foo",
                fnStub,
            );

            assert.callOrder(callstackStub.enter, fnStub, callstackStub.leave);
        });
    });

    describe("system commands", () => {
        const mkTestsSet = (getBrowser, systemCommandNameToTest) => {
            describe(`should not profile "${systemCommandNameToTest}" for`, () => {
                ["addCommand", "overwriteCommand", "extendOptions", "setMeta", "getMeta"].forEach(commandName => {
                    it(commandName, () => {
                        getBrowser().publicAPI[systemCommandNameToTest](commandName, () => {});
                        getBrowser().publicAPI[commandName]("some-arg");

                        assert.isTrue(
                            getBrowser()
                                .callstackHistory.release()
                                .every(node => node.n !== commandName),
                        );
                    });
                });
            });
        };

        describe("Browser", () => {
            let browser;

            beforeEach(async () => {
                sandbox.stub(webdriverio, "remote").resolves(mkSessionStub_());
                sandbox.stub(webdriverio, "attach").resolves(mkSessionStub_());
                sandbox.stub(webdriver.WebDriver, "newSession").resolves(mkSessionStub_());
                const ExistingBrowser = proxyquire("src/browser/existing-browser", {
                    "./client-bridge": {
                        build: sandbox.stub().resolves(),
                    },
                }).ExistingBrowser;
                browser = mkExistingBrowser_({ saveHistory: true }, void 0, ExistingBrowser);

                await browser.init({ sessionId: "session-id", sessionCaps: {}, sessionOpts: { capabilities: {} } });
            });

            mkTestsSet(() => browser, "addCommand");
            mkTestsSet(() => browser, "overwriteCommand");
        });
    });
});
