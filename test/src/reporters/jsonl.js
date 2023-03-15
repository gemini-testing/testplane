const path = require('path');
const {EventEmitter} = require('events');
const proxyquire = require('proxyquire');
const _ = require('lodash');
const RunnerEvents = require('src/constants/runner-events');
const {SUCCESS, FAIL, RETRY, SKIPPED} = require('src/constants/test-statuses');

const testStates = {
    RETRY: 'retried',
    TEST_FAIL: 'failed'
};

describe('Jsonl reporter', () => {
    const sandbox = sinon.sandbox.create();
    let JsonlReporter, initInformer, informer, emitter;

    const emit = (event, data) => {
        emitter.emit(RunnerEvents.RUNNER_START);
        if (event) {
            emitter.emit(event, data);
        }
        emitter.emit(RunnerEvents.RUNNER_END, {});
    };

    const createJsonlReporter = async (opts = {}) => {
        const reporter = await JsonlReporter.create(opts);
        reporter.attachRunner(emitter);
    };

    const mkTest_ = (opts = {}) => {
        return _.defaults(opts, {
            fullTitle: () => 'default_suite default_test',
            browserId: 'default_bro',
            file: path.resolve(process.cwd(), './default/path'),
            sessionId: '100500',
            duration: '500100',
            startTime: Date.now(),
            meta: {browserVersion: '99999'}
        });
    };

    beforeEach(() => {
        emitter = new EventEmitter();

        informer = {
            log: sandbox.stub(),
            warn: sandbox.stub(),
            error: sandbox.stub(),
            end: sandbox.stub()
        };

        initInformer = sandbox.stub().resolves(informer);

        JsonlReporter = proxyquire('src/reporters/jsonl', {
            './base': proxyquire('src/reporters/base', {
                './informers': {initInformer}
            })
        });
    });

    afterEach(() => sandbox.restore());

    it('should initialize informer with passed args', async () => {
        const opts = {type: 'jsonl', path: './report.jsonl'};

        await createJsonlReporter(opts);

        assert.calledOnceWith(initInformer, opts);
    });

    [RunnerEvents.INFO, RunnerEvents.WARNING, RunnerEvents.ERROR].forEach((eventName) => {
        it(`should do nothing on ${eventName} event`, async () => {
            await createJsonlReporter();

            emit(eventName, 'foo');

            assert.notCalled(informer.log);
            assert.notCalled(informer.warn);
            assert.notCalled(informer.error);
        });
    });

    it('should inform about successful test', async () => {
        const test = mkTest_({
            fullTitle: () => 'suite test',
            browserId: 'yabro',
            file: path.resolve(process.cwd(), './path/to/test'),
            sessionId: '12345',
            duration: '100500',
            startTime: Date.now(),
            meta: {browserVersion: '99'}
        });

        await createJsonlReporter();
        emit(RunnerEvents.TEST_PASS, test);

        assert.deepEqual(informer.log.firstCall.args[0], {...test, fullTitle: 'suite test', file: 'path/to/test', status: SUCCESS});
    });

    [
        {event: 'RETRY', status: RETRY},
        {event: 'TEST_FAIL', status: FAIL}
    ].forEach(({event, status}) => {
        describe(`"${testStates[event]}" tests report`, () => {
            it(`should inform about ${testStates[event]} test`, async () => {
                const test = mkTest_({
                    fullTitle: () => 'suite test',
                    browserId: 'yabro',
                    file: path.resolve(process.cwd(), './path/to/test'),
                    sessionId: '12345',
                    duration: '100500',
                    startTime: Date.now(),
                    meta: {browserVersion: '99'}
                });

                await createJsonlReporter();
                emit(RunnerEvents[event], test);

                assert.deepEqual(informer.log.firstCall.args[0], {...test, fullTitle: 'suite test', file: 'path/to/test', status});
            });

            it(`should add "error" field with "stack" from ${testStates[event]} test`, async () => {
                const test = mkTest_({
                    err: {
                        stack: 'o.O',
                        message: 'O.o'
                    }
                });

                await createJsonlReporter();
                emit(RunnerEvents[event], test);

                assert.equal(informer.log.firstCall.args[0].error, 'o.O');
            });

            it(`should add "error" field with "message" from ${testStates[event]} test if "stack" does not exist`, async () => {
                const test = mkTest_({
                    err: {
                        message: 'O.o'
                    }
                });

                await createJsonlReporter();
                emit(RunnerEvents[event], test);

                assert.equal(informer.log.firstCall.args[0].error, 'O.o');
            });

            it(`should add "error" field if it's specified as string in ${testStates[event]} test`, async () => {
                const test = mkTest_({
                    err: 'o.O'
                });

                await createJsonlReporter();
                emit(RunnerEvents[event], test);

                assert.equal(informer.log.firstCall.args[0].error, 'o.O');
            });

            it(`should add "error" field with original selenium error if it exists in ${testStates[event]} test`, async () => {
                const test = mkTest_({
                    err: {
                        message: 'O.o',
                        seleniumStack: {
                            orgStatusMessage: 'some original message'
                        }
                    }
                });

                await createJsonlReporter();
                emit(RunnerEvents[event], test);

                assert.equal(informer.log.firstCall.args[0].error, 'O.o (some original message)');
            });
        });
    });

    describe('skipped tests report', () => {
        it('should inform about skipped test', async () => {
            const test = mkTest_({
                fullTitle: () => 'suite test',
                browserId: 'yabro',
                file: path.resolve(process.cwd(), './path/to/test'),
                sessionId: '12345',
                duration: '100500',
                startTime: Date.now(),
                meta: {browserVersion: '99'}
            });

            await createJsonlReporter();
            emit(RunnerEvents.TEST_PENDING, test);

            assert.deepEqual(informer.log.firstCall.args[0], {...test, fullTitle: 'suite test', file: 'path/to/test', status: SKIPPED});
        });

        it('should add skip comment', async () => {
            const test = mkTest_({
                pending: true,
                skipReason: 'some comment'
            });

            await createJsonlReporter();
            emit(RunnerEvents.TEST_PENDING, test);

            assert.equal(informer.log.firstCall.args[0].reason, 'some comment');
        });

        it('should use parent skip comment if test suite was skipped', async () => {
            const test = mkTest_({
                pending: true,
                skipReason: 'test comment',
                parent: {
                    skipReason: 'suite comment'
                }
            });

            await createJsonlReporter();
            emit(RunnerEvents.TEST_PENDING, test);

            assert.equal(informer.log.firstCall.args[0].reason, 'suite comment');
        });

        it('should use test skip comment if suite was skipped without comment', async () => {
            const test = mkTest_({
                pending: true,
                skipReason: 'test comment',
                parent: {some: 'data'}
            });

            await createJsonlReporter();
            emit(RunnerEvents.TEST_PENDING, test);

            assert.equal(informer.log.firstCall.args[0].reason, 'test comment');
        });

        it('should set undefined if test was skipped without comment', async () => {
            const test = mkTest_({pending: true});

            await createJsonlReporter();
            emit(RunnerEvents.TEST_PENDING, test);

            assert.isUndefined(informer.log.firstCall.args[0].reason);
        });
    });
});
