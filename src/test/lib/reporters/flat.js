"use strict";

const chalk = require("chalk");
const path = require("path");
const { EventEmitter } = require("events");
const proxyquire = require("proxyquire");
const RunnerEvents = require("lib/constants/runner-events");
const { mkTestStub_, getDeserializedResult } = require("./utils");

describe("Flat reporter", () => {
    const sandbox = sinon.sandbox.create();
    let FlatReporter, initInformer, informer, emitter, test, stdout;

    const emit = (event, data) => {
        emitter.emit(RunnerEvents.RUNNER_START);
        if (event) {
            emitter.emit(event, data);
        }
        emitter.emit(RunnerEvents.RUNNER_END, {});
    };

    const createFlatReporter = async (opts = {}) => {
        const reporter = await FlatReporter.create(opts);
        reporter.attachRunner(emitter);
    };

    beforeEach(() => {
        test = mkTestStub_();
        emitter = new EventEmitter();
        stdout = "";

        informer = {
            log: sandbox.stub().callsFake((str) => stdout += `${str}\n`),
            warn: sandbox.stub(),
            error: sandbox.stub(),
            end: sandbox.stub(),
        };

        initInformer = sandbox.stub().resolves(informer);

        FlatReporter = proxyquire("lib/reporters/flat", {
            "./base": proxyquire("lib/reporters/base", {
                "./informers": { initInformer },
            }),
        });
    });

    afterEach(() => sandbox.restore());

    it("should initialize informer with passed args", async () => {
        const opts = { type: "flat", path: "./flat.txt" };

        await createFlatReporter(opts);

        assert.calledOnceWith(initInformer, opts);
    });

    it("should inform about info", async () => {
        await createFlatReporter();

        emit(RunnerEvents.INFO, "foo");

        assert.calledWith(informer.log, "foo");
    });

    it("should inform about warning", async () => {
        await createFlatReporter();

        emit(RunnerEvents.WARNING, "foo");

        assert.calledWith(informer.warn, "foo");
    });

    it("should inform about error", async () => {
        await createFlatReporter();

        emit(RunnerEvents.ERROR, "foo");

        assert.calledWith(informer.error, chalk.red("foo"));
    });

    it("should inform about statistics of the tests execution", async () => {
        await createFlatReporter();

        emit(RunnerEvents.RUNNER_END, {
            total: 5,
            passed: 2,
            failed: 2,
            skipped: 1,
            retries: 2,
        });

        const deserealizedResult = chalk.stripColor(informer.log.firstCall.args[0]);

        assert.equal(deserealizedResult, "Total: 5 Passed: 2 Failed: 2 Skipped: 1 Retries: 2");
    });

    describe("rendering", () => {
        const testStates = {
            RETRY: "retried",
            TEST_FAIL: "failed",
        };

        it("should correctly do the rendering", async () => {
            test = mkTestStub_({ sessionId: "test_session" });

            await createFlatReporter();
            emit(RunnerEvents.TEST_PASS, test);

            const result = getDeserializedResult(informer.log.firstCall.args[0]);

            assert.equal(result, "suite test [chrome:test_session] - 100500ms");
        });

        describe("skipped tests report", () => {
            it("should add skip comment if test was skipped", async () => {
                test = mkTestStub_({
                    pending: true,
                    skipReason: "some comment",
                });

                await createFlatReporter();
                emit(RunnerEvents.TEST_PENDING, test);

                const result = getDeserializedResult(informer.log.firstCall.args[0]);

                assert.match(result, /reason: some comment/);
            });

            it("should use parent skip comment if all describe was skipped", async () => {
                test = mkTestStub_({
                    pending: true,
                    skipReason: "test comment",
                    parent: {
                        skipReason: "suite comment",
                    },
                });

                await createFlatReporter();
                emit(RunnerEvents.TEST_PENDING, test);

                const result = getDeserializedResult(informer.log.firstCall.args[0]);

                assert.match(result, /reason: suite comment/);
            });

            it("should use test skip comment if describe was skipped without comment", async () => {
                test = mkTestStub_({
                    pending: true,
                    skipReason: "test comment",
                    parent: { some: "data" },
                });

                await createFlatReporter();
                emit(RunnerEvents.TEST_PENDING, test);

                const result = getDeserializedResult(informer.log.firstCall.args[0]);

                assert.match(result, /reason: test comment/);
            });

            it("should use default message if test was skipped without comment", async () => {
                test = mkTestStub_({
                    pending: true,
                });

                await createFlatReporter();
                emit(RunnerEvents.TEST_PENDING, test);

                const result = getDeserializedResult(informer.log.firstCall.args[0]);

                assert.match(result, /reason: no comment/);
            });
        });

        ["RETRY", "TEST_FAIL"].forEach((event) => {
            describe(`${testStates[event]} tests report`, () => {
                it(`should log correct number of ${testStates[event]} suite`, async () => {
                    test = mkTestStub_();

                    await createFlatReporter();
                    emit(RunnerEvents[event], test);

                    assert.match(stdout, /1\) .+/);
                });

                it(`should log full title of ${testStates[event]} suite`, async () => {
                    test = mkTestStub_();

                    await createFlatReporter();
                    emit(RunnerEvents[event], test);

                    assert.include(stdout, test.fullTitle());
                });

                it(`should log path to file of ${testStates[event]} suite`, async () => {
                    test = mkTestStub_();
                    sandbox.stub(path, "relative").returns(`relative/${test.file}`);

                    await createFlatReporter();
                    emit(RunnerEvents[event], test);

                    assert.include(stdout, test.file);
                });

                it(`should log browser of ${testStates[event]} suite`, async () => {
                    test = mkTestStub_({
                        browserId: "bro1",
                    });

                    await createFlatReporter();
                    emit(RunnerEvents[event], test);

                    assert.match(stdout, /bro1/);
                });

                it(`should log an error stack of ${testStates[event]} test`, async () => {
                    test = mkTestStub_({
                        err: { stack: "some stack" },
                    });

                    await createFlatReporter();
                    emit(RunnerEvents[event], test);

                    assert.match(stdout, /some stack/);
                });

                it(`should log an error message of ${testStates[event]} test if an error stack does not exist`, async () => {
                    test = mkTestStub_({
                        err: { message: "some message" },
                    });

                    await createFlatReporter();
                    emit(RunnerEvents[event], test);

                    assert.match(stdout, /some message/);
                });

                it(`should log an error of ${testStates[event]} test if an error stack and message do not exist`, async () => {
                    test = mkTestStub_({
                        err: "some error",
                    });

                    await createFlatReporter();
                    emit(RunnerEvents[event], test);

                    assert.match(stdout, /some error/);
                });

                it("should extend error with original selenium error if it exists", async () => {
                    test = mkTestStub_({
                        err: {
                            stack: "some stack",
                            seleniumStack: {
                                orgStatusMessage: "some original message",
                            },
                        },
                    });

                    await createFlatReporter();
                    emit(RunnerEvents[event], test);

                    assert.match(stdout, /some stack \(some original message\)/);
                });

                it(`should log "undefined" if ${testStates[event]} test does not have "err" property`, async () => {
                    test = mkTestStub_();

                    await createFlatReporter();
                    emit(RunnerEvents[event], test);

                    assert.match(stdout, /undefined/);
                });
            });
        });

        describe("failed tests report", () => {
            it("should log path to file of failed hook", async () => {
                test = mkTestStub_({
                    file: null,
                    parent: {
                        file: "path-to-test",
                    },
                });

                sandbox.stub(path, "relative").returns(`relative/${test.parent.file}`);

                await createFlatReporter();
                emit(RunnerEvents.TEST_FAIL, test);

                assert.include(stdout, "relative/path-to-test");
            });

            it("should not throw if path to file is not specified on failed hook", async () => {
                test = mkTestStub_({
                    file: null,
                    parent: {},
                });

                await createFlatReporter();

                assert.doesNotThrow(() => emit(RunnerEvents.TEST_FAIL, test));
            });
        });
    });
});
