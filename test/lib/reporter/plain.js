'use strict';

const EventEmitter = require('events').EventEmitter;
const logger = require('../../../lib/utils').logger;
const PlainReporter = require('../../../lib/reporters/plain');
const RunnerEvents = require('../../../lib/constants/runner-events');

const mkTestStub_ = require('./utils').mkTestStub_;
const getDeserializedResult = require('./utils').getDeserializedResult;

describe('Plain reporter', () => {
    const sandbox = sinon.sandbox.create();

    let test;
    let emitter;
    let stdout;

    const emit = (event, data) => {
        emitter.emit(RunnerEvents.RUNNER_START);
        if (event) {
            emitter.emit(event, data);
        }
        emitter.emit(RunnerEvents.RUNNER_END);
    };

    beforeEach(() => {
        test = mkTestStub_();

        const reporter = new PlainReporter();

        emitter = new EventEmitter();
        reporter.attachRunner(emitter);

        stdout = '';
        sandbox.stub(logger, 'log').callsFake((str) => stdout += `${str}\n`);

        sandbox.stub(logger, 'warn');
        sandbox.stub(logger, 'error');
    });

    afterEach(() => sandbox.restore());

    const testSates = {
        RETRY: 'retried',
        TEST_FAIL: 'failed'
    };

    ['RETRY', 'TEST_FAIL'].forEach((event) => {
        it(`should log correct info about ${testSates[event]} test`, () => {
            test = mkTestStub_({
                fullTitle: () => 'some test title',
                title: 'test title',
                file: 'some/path/file.js',
                browserId: 'bro',
                duration: '100',
                err: {stack: 'some error stack'}
            });

            emit(RunnerEvents[event], test);

            assert.match(
                getDeserializedResult(stdout),
                /some test title \[bro\] - 100ms\s.+some\/path\/file.js\s.+some error stack/
            );
        });
    });
});
