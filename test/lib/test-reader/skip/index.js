'use strict';

const _ = require('lodash');
const Skip = require('build/test-reader/skip/');

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
        describe('loud skip', () => {
            beforeEach(() => skip.silent = false);

            it('should extend test data with additional info if an entity should be skipped', () => {
                const test = mkTest();
                skip.shouldSkip = true;

                skip.handleEntity(test);

                assert.propertyVal(test, 'pending', true);
                assert.property(test, 'skipReason');
            });

            it('should not extend test data if an entity should not be skipped', () => {
                const test = mkTest();
                skip.shouldSkip = false;

                skip.handleEntity(test);

                assert.notProperty(test, 'pending');
                assert.notProperty(test, 'skipReason');
            });

            it('should reset skip data after skip', () => {
                const test = mkTest();
                skip.shouldSkip = true;

                skip.handleEntity(test);

                assert.equal(skip.comment, '');
                assert.equal(skip.shouldSkip, false);
                assert.equal(skip.silent, false);
            });
        });

        describe('silent skip', () => {
            beforeEach(() => skip.silent = true);

            it('should extend test data with additional info if an entity should be skipped', () => {
                const test = mkTest();
                skip.shouldSkip = true;

                skip.handleEntity(test);

                assert.propertyVal(test, 'pending', true);
                assert.propertyVal(test, 'silentSkip', true);
            });

            it('should not extend test data if an entity should not be skipped', () => {
                const test = mkTest();
                skip.shouldSkip = false;

                skip.handleEntity(test);

                assert.notProperty(test, 'pending');
                assert.notProperty(test, 'skipReason');
            });

            it('should reset skip data after skip', () => {
                const test = mkTest();
                skip.shouldSkip = true;

                skip.handleEntity(test);

                assert.equal(skip.comment, '');
                assert.equal(skip.shouldSkip, false);
                assert.equal(skip.silent, false);
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
