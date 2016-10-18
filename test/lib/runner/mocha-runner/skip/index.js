'use strict';

const _ = require('lodash');
const Skip = require('../../../../../lib/runner/mocha-runner/skip/');

describe('Skip', () => {
    let skip;

    const mkTest = (opts) => {
        return _.defaults(opts || {}, {
            parent: {
                suites: [],
                tests: []
            }
        });
    };

    beforeEach(() => {
        skip = new Skip();
    });

    describe('constructor', () => {
        it('should not skip test silently by default', () => {
            assert.equal(skip.shouldSkip, false);
            assert.equal(skip.silent, false);
        });
    });

    describe('handleEntity', () => {
        it('should extend test data with additional info', () => {
            const test = mkTest();
            skip.shouldSkip = true;
            skip.silent = false;

            skip.handleEntity(test);

            assert.propertyVal(test, 'pending', true);
            assert.property(test, 'skipReason');
        });

        it('should not extend test data if browser does not match', () => {
            const test = mkTest();
            skip.shouldSkip = false;
            skip.silent = false;

            skip.handleEntity(test);

            assert.notProperty(test, 'pending');
            assert.notProperty(test, 'skipReason');
        });

        it('should not mark silently skipped test as skipped', () => {
            const test = mkTest();
            skip.shouldSkip = true;
            skip.silent = true;

            skip.handleEntity(test);

            assert.notProperty(test, 'pending');
            assert.notProperty(test, 'skipReason');
        });

        it('should reset skip data after test will be skipped', () => {
            const test = mkTest();
            skip.shouldSkip = true;
            skip.silent = false;

            skip.handleEntity(test);

            assert.equal(skip.comment, '');
            assert.equal(skip.shouldSkip, false);
            assert.equal(skip.silent, false);
        });

        describe('silent flag', () => {
            it('should remove silently skipped test from the end of parent tests', () => {
                const test = _.set({type: 'test'}, 'parent.tests', ['test1', 'test2']);
                skip.shouldSkip = true;
                skip.silent = true;

                skip.handleEntity(test);

                assert.deepEqual(test.parent.tests, ['test1']);
            });

            it('should not remove skipped test without silent flag from parent', () => {
                const test = _.set({type: 'test'}, 'parent.tests', ['test1']);
                skip.shouldSkip = true;
                skip.silent = false;

                skip.handleEntity(test);

                assert.deepEqual(test.parent.tests, ['test1']);
            });

            it('should remove silently skipped suite from the end of parent suites', () => {
                const suite = _.set({}, 'parent.suites', ['suite1', 'suite2']);
                skip.shouldSkip = true;
                skip.silent = true;

                skip.handleEntity(suite);

                assert.deepEqual(suite.parent.suites, ['suite1']);
            });

            it('should not remove skipped suite without silent flag from parent', () => {
                const suite = _.set({type: 'test'}, 'parent.suites', ['suite1']);
                skip.shouldSkip = true;
                skip.silent = false;

                skip.handleEntity(suite);

                assert.deepEqual(suite.parent.suites, ['suite1']);
            });
        });
    });

    describe('setComment', () => {
        it('should pass comment to the test info', () => {
            const test = mkTest();
            skip.shouldSkip = true;
            skip.silent = false;
            skip.comment = 'comment';

            skip.handleEntity(test);

            assert.equal(test.skipReason, 'comment');
        });
    });
});
