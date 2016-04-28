'use strict';

const Skip = require('../../../../../lib/runner/mocha-runner/skip/');

describe('Skip', () => {
    let skip, test;

    beforeEach(() => {
        skip = new Skip();
        test = {};
    });

    describe('constructor', () => {
        it('should not skip test by default', () => {
            assert.equal(skip.shouldSkip, false);
        });
    });

    describe('handleEntity', () => {
        it('should extend test data with additional info', () => {
            skip.shouldSkip = true;
            skip.handleEntity(test);

            assert.propertyVal(test, 'pending', true);
            assert.property(test, 'skipReason');
        });

        it('should not extend test data if browser does not match', () => {
            skip.shouldSkip = false;
            skip.handleEntity(test);

            assert.notProperty(test, 'pending');
            assert.notProperty(test, 'skipReason');
        });

        it('should reset skip data after test will be skipped', () => {
            skip.shouldSkip = true;
            skip.handleEntity(test);

            assert.equal(skip.shouldSkip, false);
            assert.equal(skip.comment, '');
        });
    });

    describe('setComment', () => {
        it('should pass comment to the test info', () => {
            skip.shouldSkip = true;
            skip.comment = 'comment';
            skip.handleEntity(test);

            assert.equal(test.skipReason, 'comment');
        });
    });
});
