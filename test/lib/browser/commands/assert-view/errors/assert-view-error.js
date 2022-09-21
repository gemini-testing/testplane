'use strict';

const AssertViewError = require('build/browser/commands/assert-view/errors/assert-view-error');

describe('AssertViewError', () => {
    it('should be an instance of Error', () => {
        assert.instanceOf(new AssertViewError(), Error);
    });

    it('should have default error message', () => {
        assert.equal(new AssertViewError().message, 'image comparison failed');
    });

    it('should allow to overwrite default error message', () => {
        assert.equal(new AssertViewError('foo bar').message, 'foo bar');
    });
});
