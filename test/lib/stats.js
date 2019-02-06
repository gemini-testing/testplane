'use strict';

const {EventEmitter} = require('events');
const RunnerEvents = require('../../lib/constants/runner-events');
const Stats = require('../../lib/stats');
const {makeTest} = require('../utils');

describe('Stats', () => {
    const sandbox = sinon.sandbox.create();

    let stats;
    let runner;

    beforeEach(() => {
        runner = new EventEmitter();
        stats = Stats.create(runner);
    });

    afterEach(() => sandbox.restore());

    it('should count passed tests', () => {
        runner.emit(RunnerEvents.TEST_PASS, makeTest());

        assert.equal(stats.getResult().passed, 1);
    });

    it('should count failed tests', () => {
        runner.emit(RunnerEvents.TEST_FAIL, makeTest());

        assert.equal(stats.getResult().failed, 1);
    });

    it('should count retried tests', () => {
        runner.emit(RunnerEvents.RETRY, makeTest());
        runner.emit(RunnerEvents.TEST_PASS, makeTest());

        assert.equal(stats.getResult().total, 1);
        assert.equal(stats.getResult().retries, 1);
        assert.equal(stats.getResult().passed, 1);
    });

    it('should count skipped tests', () => {
        runner.emit(RunnerEvents.TEST_PENDING, makeTest());

        assert.equal(stats.getResult().skipped, 1);
    });

    it('should count total test count', () => {
        runner.emit(RunnerEvents.TEST_PASS, makeTest({title: 'passed'}));
        runner.emit(RunnerEvents.TEST_FAIL, makeTest({title: 'failed'}));

        assert.equal(stats.getResult().total, 2);
    });

    it('should return correct full statistic', () => {
        runner.emit(RunnerEvents.TEST_PASS, makeTest({title: 'passed'}));
        runner.emit(RunnerEvents.RETRY, makeTest({title: 'failed'}));
        runner.emit(RunnerEvents.TEST_FAIL, makeTest({title: 'failed'}));
        runner.emit(RunnerEvents.TEST_PENDING, makeTest({title: 'skipped'}));

        assert.deepEqual(stats.getResult(), {
            total: 3,
            passed: 1,
            failed: 1,
            skipped: 1,
            retries: 1,
            perBrowser: {
                yabro: {
                    failed: 1,
                    passed: 1,
                    retries: 1,
                    skipped: 1,
                    total: 3
                }
            }
        });
    });

    it('should handle cases when several events were emitted for the same test', () => {
        runner.emit(RunnerEvents.SKIP_STATE, makeTest({title: 'some-name'}));
        runner.emit(RunnerEvents.TEST_FAIL, makeTest({title: 'some-name'}));

        assert.equal(stats.getResult().skipped, 0);
        assert.equal(stats.getResult().failed, 1);
    });

    it('should not count test result twice for the same title and browser', () => {
        const test = makeTest({
            browserId: 'test_browser',
            title: 'test_title'
        });

        runner.emit(RunnerEvents.TEST_PASS, test);
        runner.emit(RunnerEvents.TEST_PASS, test);

        assert.equal(stats.getResult().total, 1);
        assert.equal(stats.getResult().passed, 1);
    });

    it('should correctly handle tests with the similar titles', () => {
        const test1 = makeTest({
            parent: {fullTitle: () => 'some case'},
            browserId: 'bro'
        });
        const test2 = makeTest({
            parent: {fullTitle: () => 'some cas'},
            browserId: 'ebro'
        });

        runner.emit(RunnerEvents.TEST_FAIL, test1);
        runner.emit(RunnerEvents.TEST_FAIL, test2);

        assert.equal(stats.getResult().total, 2);
        assert.equal(stats.getResult().failed, 2);
    });

    describe('per browser stats', () => {
        it('should count passed tests', () => {
            runner.emit(RunnerEvents.TEST_PASS, makeTest({browserId: 'bro'}));

            assert.equal(stats.getResult().perBrowser.bro.passed, 1);
        });

        it('should count failed tests', () => {
            runner.emit(RunnerEvents.TEST_FAIL, makeTest({browserId: 'bro'}));

            assert.equal(stats.getResult().perBrowser.bro.failed, 1);
        });

        it('should count retried tests', () => {
            runner.emit(RunnerEvents.RETRY, makeTest({browserId: 'bro'}));

            assert.equal(stats.getResult().perBrowser.bro.retries, 1);
        });

        it('should count skipped tests', () => {
            runner.emit(RunnerEvents.TEST_PENDING, makeTest({browserId: 'bro'}));

            assert.equal(stats.getResult().perBrowser.bro.skipped, 1);
        });

        it('should count total test count', () => {
            runner.emit(RunnerEvents.TEST_PASS, makeTest({browserId: 'bro', title: 'passed'}));
            runner.emit(RunnerEvents.TEST_FAIL, makeTest({browserId: 'bro', title: 'failed'}));
            runner.emit(RunnerEvents.TEST_PENDING, makeTest({browserId: 'bro', title: 'skipped'}));

            assert.equal(stats.getResult().perBrowser.bro.total, 3);
        });

        it('should handle cases when several events were emitted for the same test', () => {
            runner.emit(RunnerEvents.SKIP_STATE, makeTest({browserId: 'bro', title: 'some-name'}));
            runner.emit(RunnerEvents.TEST_FAIL, makeTest({browserId: 'bro', title: 'some-name'}));

            assert.equal(stats.getResult().perBrowser.bro.skipped, 0);
            assert.equal(stats.getResult().perBrowser.bro.failed, 1);
        });

        it('should not count test result twice for the same title and browser', () => {
            const test = makeTest({
                browserId: 'bro',
                title: 'test_title'
            });

            runner.emit(RunnerEvents.TEST_PASS, test);
            runner.emit(RunnerEvents.TEST_PASS, test);

            assert.equal(stats.getResult().perBrowser.bro.total, 1);
            assert.equal(stats.getResult().perBrowser.bro.passed, 1);
        });

        it('should correctly handle tests with the similar titles', () => {
            const test1 = makeTest({
                parent: {fullTitle: () => 'some cas'},
                browserId: 'bro'
            });
            const test2 = makeTest({
                parent: {fullTitle: () => 'some case'},
                browserId: 'ebro'
            });

            runner.emit(RunnerEvents.TEST_FAIL, test1);
            runner.emit(RunnerEvents.TEST_FAIL, test2);

            assert.equal(stats.getResult().perBrowser.bro.total, 1);
            assert.equal(stats.getResult().perBrowser.ebro.total, 1);
            assert.equal(stats.getResult().perBrowser.bro.failed, 1);
            assert.equal(stats.getResult().perBrowser.ebro.failed, 1);
        });
    });
});
