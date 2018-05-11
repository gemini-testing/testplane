'use strict';

const AssertViewError = require('lib/browser/commands/assert-view/errors/assert-view-error');

describe('AssertViewError', () => {
    it('should be an instance of Error', () => {
        assert.instanceOf(new AssertViewError(), Error);
    });
});
