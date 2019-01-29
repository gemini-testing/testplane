'use strict';

const _ = require('lodash');
const {handleImageDiff} = require('lib/browser/commands/assert-view/capture-processors/assert-refs');
const ImageDiffError = require('lib/browser/commands/assert-view/errors/image-diff-error');

describe('browser/commands/assert-view/capture-processors/assert-refs', () => {
    const sandbox = sinon.createSandbox();

    beforeEach(() => {
        sandbox.stub(ImageDiffError, 'create');
    });

    afterEach(() => sandbox.restore());

    describe('handleImageDiff', () => {
        const mkConfig_ = (opts = {}) => {
            return _.defaultsDeep(opts, {
                tolerance: 111,
                antialiasingTolerance: 222,
                buildDiffOpts: {},
                system: {diffColor: 'default-color'}
            });
        };

        const handleImageDiff_ = (opts = {}) => {
            const {currImg, refImg, state, diffOpts} = _.defaultsDeep(opts, {
                currImg: {path: '/default-curr/path'},
                refImg: {path: '/default-ref/path'},
                state: 'default-state',
                diffOpts: {
                    diffBounds: 'default-bounds',
                    config: mkConfig_(opts.config)
                }
            });

            return handleImageDiff(currImg, refImg, state, diffOpts);
        };

        describe('should create instace of "ImageDiffError" with', () => {
            it('diff options from "buildDiffOpts"', async () => {
                const config = {
                    buildDiffOpts: {foo: 'bar', baz: 'qux'}
                };

                await handleImageDiff_({config})
                    .catch(() => {
                        assert.calledOnceWith(
                            ImageDiffError.create,
                            sinon.match.any, sinon.match.any, sinon.match.any,
                            sinon.match({foo: 'bar', baz: 'qux'})
                        );
                    });
            });

            it('with overriden diff option from "buildDiffOpts"', async () => {
                const config = {
                    buildDiffOpts: {tolerance: 100500},
                    tolerance: 500100
                };

                await handleImageDiff_({config})
                    .catch(() => {
                        assert.calledOnceWith(
                            ImageDiffError.create,
                            sinon.match.any, sinon.match.any, sinon.match.any,
                            sinon.match({tolerance: 100500})
                        );
                    });
            });
        });
    });
});
