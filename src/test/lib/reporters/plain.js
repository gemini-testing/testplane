'use strict';

const EventEmitter = require('events').EventEmitter;
const RunnerEvents = require('lib/constants/runner-events');
const proxyquire = require('proxyquire');
const mkTestStub_ = require('./utils').mkTestStub_;
const getDeserializedResult = require('./utils').getDeserializedResult;

describe('Plain reporter', () => {
    const sandbox = sinon.sandbox.create();
    let PlainReporter, initInformer, informer, emitter, test, stdout;

    const emit = (event, data) => {
        emitter.emit(RunnerEvents.RUNNER_START);
        if (event) {
            emitter.emit(event, data);
        }
        emitter.emit(RunnerEvents.RUNNER_END, {});
    };

    const createPlainReporter = async (opts = {}) => {
        const reporter = await PlainReporter.create(opts);
        reporter.attachRunner(emitter);
    };

    beforeEach(() => {
        test = mkTestStub_();
        emitter = new EventEmitter();
        stdout = '';

        informer = {
            log: sandbox.stub().callsFake((str) => stdout += `${str}\n`),
            warn: sandbox.stub(),
            error: sandbox.stub(),
            end: sandbox.stub()
        };

        initInformer = sandbox.stub().resolves(informer);

        PlainReporter = proxyquire('lib/reporters/plain', {
            './base': proxyquire('lib/reporters/base', {
                './informers': {initInformer}
            })
        });
    });

    afterEach(() => sandbox.restore());

    it('should initialize informer with passed args', async () => {
        const opts = {type: 'plain', path: './plain.txt'};

        await createPlainReporter(opts);

        assert.calledOnceWith(initInformer, opts);
    });

    describe('success tests report', () => {
        it('should log correct info about test', async () => {
            test = mkTestStub_({
                fullTitle: () => 'some test title',
                title: 'test title',
                browserId: 'bro',
                duration: '100'
            });

            await createPlainReporter();
            emit(RunnerEvents.TEST_PASS, test);

            assert.match(
                getDeserializedResult(stdout),
                /some test title \[bro\] - 100ms/
            );
        });
    });

    const testStates = {
        RETRY: 'retried',
        TEST_FAIL: 'failed'
    };

    ['RETRY', 'TEST_FAIL'].forEach((event) => {
        describe(`${testStates[event]} tests report`, () => {
            it(`should log correct info about test`, async () => {
                test = mkTestStub_({
                    fullTitle: () => 'some test title',
                    title: 'test title',
                    file: 'some/path/file.js',
                    browserId: 'bro',
                    duration: '100',
                    err: {stack: 'some error stack'}
                });

                await createPlainReporter();
                emit(RunnerEvents[event], test);

                assert.match(
                    getDeserializedResult(stdout),
                    /some test title \[bro\] - 100ms\s.+some\/path\/file.js\s.+some error stack/
                );
            });

            it('should extend error with original selenium error if it exists', async () => {
                test = mkTestStub_({
                    err: {
                        stack: 'some stack',
                        seleniumStack: {
                            orgStatusMessage: 'some original message'
                        }
                    }
                });

                await createPlainReporter();
                emit(RunnerEvents[event], test);

                assert.match(stdout, /some stack \(some original message\)/);
            });
        });
    });
});
