'use strict';

const validateEmptyBrowsers = require('../../lib/validators').validateEmptyBrowsers;

describe('validate browsers', () => {
    it('should throw error if browsers are empty', () => {
        assert.throws(() => validateEmptyBrowsers(), '"browsers" is required option and should not be empty');
    });

    it('should throw an error if browsers are not an object', () => {
        assert.throws(() => validateEmptyBrowsers('String'), '"browsers" should be an object');
    });

    it('should not throw an error if browsers are valid object', () => {
        assert.doesNotThrow(() => validateEmptyBrowsers({baseUrl: 'url'}));
    });
});
