"use strict";

const _ = require("lodash");
const proxyquire = require("proxyquire").noCallThru();
const pluginsLoader = require("plugins-loader");
const { Config } = require("src/config");
const { MasterEvents: RunnerEvents } = require("src/events");
const Errors = require("src/errors").default;
const { TestCollection } = require("src/test-collection");
const { WorkerEvents: WorkerRunnerEvents } = require("src/events");
const Runner = require("src/worker/runner");
const { makeConfigStub, makeSuite } = require("../../utils");

describe("worker/testplane", () => {
    const sandbox = sinon.createSandbox();

    let ExpectWebdriverio;
    let Testplane;

    beforeEach(() => {
        ExpectWebdriverio = {
            setOptions: sandbox.stub(),
        };

        Testplane = proxyquire("src/worker/testplane", {
            "expect-webdriverio": ExpectWebdriverio,
            "./runner": Runner,
        }).Testplane;

        sandbox.stub(Config, "create").returns(makeConfigStub());

        sandbox.stub(pluginsLoader, "load");

        sandbox.spy(Runner, "create");
        sandbox.stub(Runner.prototype, "runTest");
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("constructor", () => {
        it("should create a config from the passed path", async () => {
            await Testplane.create("some-config-path.js");

            assert.calledOnceWith(Config.create, "some-config-path.js");
        });

        it("should create a runner instance", async () => {
            const config = makeConfigStub();
            Config.create.resolves(config);

            await Testplane.create();

            assert.calledOnceWith(Runner.create, config);
        });

        it("should passthrough all runner events", async () => {
            const testplane = await Testplane.create();

            _.forEach(
                {
                    [WorkerRunnerEvents.BEFORE_FILE_READ]: { suite: makeSuite() },
                    [WorkerRunnerEvents.AFTER_FILE_READ]: { suite: makeSuite() },
                    [WorkerRunnerEvents.AFTER_TESTS_READ]: Object.create(TestCollection.prototype),
                    [WorkerRunnerEvents.NEW_BROWSER]: { id: "someBro" },
                    [WorkerRunnerEvents.UPDATE_REFERENCE]: { path: "/ref/path" },
                },
                (data, event) => {
                    const spy = sinon.spy();
                    testplane.on(event, spy);

                    Runner.create.returnValues[0].emit(event, data);

                    assert.calledOnceWith(spy, data);
                },
            );
        });

        describe("loading of plugins", () => {
            it("should load plugins", async () => {
                await Testplane.create();

                assert.calledOnce(pluginsLoader.load);
            });

            it("should load plugins for testplane instance", async () => {
                await Testplane.create();

                assert.calledWith(pluginsLoader.load, sinon.match.instanceOf(Testplane));
            });

            it("should load plugins from config", async () => {
                Config.create.resolves(makeConfigStub({ plugins: { "some-plugin": true } }));

                await Testplane.create();

                assert.calledWith(pluginsLoader.load, sinon.match.any, { "some-plugin": true });
            });

            // testplane does not support its own plugin prefixes.
            it("should load plugins with deprecated hermione prefix", async () => {
                await Testplane.create();

                assert.calledWith(pluginsLoader.load, sinon.match.any, sinon.match.any, "hermione-");
            });
        });
    });

    describe("should provide access to", () => {
        it("testplane events", async () => {
            const expectedEvents = _.extend({}, RunnerEvents, WorkerRunnerEvents);

            const testplane = await Testplane.create(makeConfigStub());

            assert.deepEqual(testplane.events, expectedEvents);
        });

        it("testplane configuration", async () => {
            const config = makeConfigStub();

            Config.create.resolves(config);

            const testplane = await Testplane.create(makeConfigStub());

            assert.deepEqual(testplane.config, config);
        });

        it("testplane errors", async () => {
            const testplane = await Testplane.create();

            assert.deepEqual(testplane.errors, Errors);
        });
    });

    describe("init", () => {
        afterEach(() => {
            delete global.expect;
        });

        it('should emit "INIT"', async () => {
            const testplane = await Testplane.create();

            const onInit = sinon.spy();
            testplane.on(WorkerRunnerEvents.INIT, onInit);

            await testplane.init();

            assert.calledOnce(onInit);
        });

        it('should reject on "INIT" handler fail', async () => {
            const testplane = await Testplane.create();
            testplane.on(WorkerRunnerEvents.INIT, () => Promise.reject("o.O"));

            await assert.isRejected(testplane.init(), /o.O/);
        });

        it("should not init expect-webdriverio if global.expect already set", async () => {
            global.expect = {};

            const testplane = await Testplane.create();
            await testplane.init();

            assert.notCalled(ExpectWebdriverio.setOptions);
        });

        it("should not init expect-webdriverio if global.expect not set", async () => {
            Config.create.resolves({
                system: {
                    expectOpts: { foo: "bar" },
                },
            });

            const testplane = await Testplane.create();
            await testplane.init();

            assert.calledOnceWith(ExpectWebdriverio.setOptions, { foo: "bar" });
        });
    });

    describe("runTest", () => {
        it("should run test", async () => {
            Runner.prototype.runTest.withArgs("fullTitle", { some: "options" }).resolves("foo bar");

            const testplane = await Testplane.create();

            return testplane.runTest("fullTitle", { some: "options" }).then(result => assert.equal(result, "foo bar"));
        });
    });

    describe("isWorker", () => {
        it('should return "true"', async () => {
            const testplane = await Testplane.create();

            assert.isTrue(testplane.isWorker());
        });
    });
});
