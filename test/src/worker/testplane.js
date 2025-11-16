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
        it("should create a config from the passed path", () => {
            Testplane.create("some-config-path.js");

            assert.calledOnceWith(Config.create, "some-config-path.js");
        });

        it("should create a runner instance", () => {
            const config = makeConfigStub();
            Config.create.returns(config);

            Testplane.create();

            assert.calledOnceWith(Runner.create, config);
        });

        it("should passthrough all runner events", () => {
            const testplane = Testplane.create();

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
            it("should load plugins", () => {
                Testplane.create();

                assert.calledOnce(pluginsLoader.load);
            });

            it("should load plugins for testplane instance", () => {
                Testplane.create();

                assert.calledWith(pluginsLoader.load, sinon.match.instanceOf(Testplane));
            });

            it("should load plugins from config", () => {
                Config.create.returns(makeConfigStub({ plugins: { "some-plugin": true } }));

                Testplane.create();

                assert.calledWith(pluginsLoader.load, sinon.match.any, { "some-plugin": true });
            });

            // testplane does not support its own plugin prefixes.
            it("should load plugins with deprecated hermione prefix", () => {
                Testplane.create();

                assert.calledWith(pluginsLoader.load, sinon.match.any, sinon.match.any, "hermione-");
            });
        });
    });

    describe("should provide access to", () => {
        it("testplane events", () => {
            const expectedEvents = _.extend({}, RunnerEvents, WorkerRunnerEvents);

            assert.deepEqual(Testplane.create(makeConfigStub()).events, expectedEvents);
        });

        it("testplane configuration", () => {
            const config = makeConfigStub();

            Config.create.returns(config);

            assert.deepEqual(Testplane.create().config, config);
        });

        it("testplane errors", () => {
            assert.deepEqual(Testplane.create().errors, Errors);
        });
    });

    describe("init", () => {
        afterEach(() => {
            delete global.expect;
        });

        it('should emit "INIT"', () => {
            const testplane = Testplane.create();

            const onInit = sinon.spy();
            testplane.on(WorkerRunnerEvents.INIT, onInit);

            return testplane.init().then(() => assert.calledOnce(onInit));
        });

        it('should reject on "INIT" handler fail', () => {
            const testplane = Testplane.create().on(WorkerRunnerEvents.INIT, () => Promise.reject("o.O"));

            return assert.isRejected(testplane.init(), /o.O/);
        });

        it("should not init expect-webdriverio if global.expect already set", async () => {
            global.expect = {};

            await Testplane.create().init();

            assert.notCalled(ExpectWebdriverio.setOptions);
        });

        it("should not init expect-webdriverio if global.expect not set", async () => {
            Config.create.returns({
                system: {
                    expectOpts: { foo: "bar" },
                },
            });

            await Testplane.create().init();

            assert.calledOnceWith(ExpectWebdriverio.setOptions, { foo: "bar" });
        });
    });

    describe("runTest", () => {
        it("should run test", () => {
            Runner.prototype.runTest.withArgs("fullTitle", { some: "options" }).resolves("foo bar");

            const testplane = Testplane.create();

            return testplane.runTest("fullTitle", { some: "options" }).then(result => assert.equal(result, "foo bar"));
        });
    });

    describe("isWorker", () => {
        it('should return "true"', () => {
            const testplane = Testplane.create();

            assert.isTrue(testplane.isWorker());
        });
    });
});
