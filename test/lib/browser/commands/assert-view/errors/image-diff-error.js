'use strict';

const {Image} = require('gemini-core');
const BaseStateError = require('lib/browser/commands/assert-view/errors/base-state-error');
const ImageDiffError = require('lib/browser/commands/assert-view/errors/image-diff-error');

describe('ImageDiffError', () => {
    const sandbox = sinon.sandbox.create();

    beforeEach(() => {
        sandbox.stub(Image, 'buildDiff').resolves();
    });

    afterEach(() => sandbox.restore());

    it('should be an instance of "BaseStateError"', () => {
        assert.instanceOf(new ImageDiffError(), BaseStateError);
    });

    it('should be eventually an instance of Error', () => {
        assert.instanceOf(new ImageDiffError(), Error);
    });

    it('should contain a state name in an error message', () => {
        const error = new ImageDiffError('plain');

        assert.match(error.message, /images are different for "plain" state/);
    });

    it('should contain a state name', () => {
        const error = new ImageDiffError('plain');

        assert.equal(error.stateName, 'plain');
    });

    it('should contain a current image path', () => {
        const error = new ImageDiffError('', '/curr/path');

        assert.equal(error.currentImagePath, '/curr/path');
    });

    it('should contain a reference image path', () => {
        const error = new ImageDiffError('', '', '/ref/path');

        assert.equal(error.refImagePath, '/ref/path');
    });

    it('should contain options for image diff building', () => {
        const error = new ImageDiffError('', '', '', {}, {some: 'opts'});

        assert.deepEqual(error.diffOpts, {some: 'opts'});
    });

    it('should create an instance of error from object', () => {
        const error = ImageDiffError.fromObject({stateName: 'name', currentImagePath: 'curr/path', refImagePath: 'ref/path', diffOpts: {foo: 'bar'}});

        assert.instanceOf(error, ImageDiffError);
        assert.deepInclude(Object.assign({}, error), {stateName: 'name', currentImagePath: 'curr/path', refImagePath: 'ref/path', diffOpts: {foo: 'bar'}});
    });

    it('should provide the ability to save diff image', () => {
        const error = new ImageDiffError('', '', '', {}, {some: 'opts'});

        Image.buildDiff.withArgs({some: 'opts', diff: 'diff/path'}).resolves({foo: 'bar'});

        return assert.becomes(error.saveDiffTo('diff/path'), {foo: 'bar'});
    });
});
