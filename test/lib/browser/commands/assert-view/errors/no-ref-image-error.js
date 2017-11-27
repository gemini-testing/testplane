'use strict';

const AssertViewError = require('lib/browser/commands/assert-view/errors/assert-view-error');
const NoRefImageError = require('lib/browser/commands/assert-view/errors/no-ref-image-error');

describe('NoRefImageError', () => {
    it('should be an instance of "AssertViewError"', () => {
        assert.instanceOf(new NoRefImageError(), AssertViewError);
    });

    it('should be eventually an instance of Error', () => {
        assert.instanceOf(new NoRefImageError(), Error);
    });

    it('should contain a state name', () => {
        const error = new NoRefImageError('plain');

        assert.equal(error.stateName, 'plain');
    });

    it('should contain a current image path', () => {
        const error = new NoRefImageError('', '/curr/path');

        assert.equal(error.currentImagePath, '/curr/path');
    });

    it('should contain state name and reference image path in an error message', () => {
        const error = new NoRefImageError('plain', '', 'refPath');

        assert.match(error.message, /reference image at refPath for "plain" state./);
    });
});
