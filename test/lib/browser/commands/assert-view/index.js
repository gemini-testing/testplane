'use strict';

const fs = require('fs');
const fsExtra = require('fs-extra');
const webdriverio = require('webdriverio');
const {Image, temp} = require('gemini-core');
const RuntimeConfig = require('lib/config/runtime-config');
const NoRefImageError = require('lib/browser/commands/assert-view/errors/no-ref-image-error');
const ImageDiffError = require('lib/browser/commands/assert-view/errors/image-diff-error');
const {mkExistingBrowser_: mkBrowser_, mkSessionStub_} = require('../../utils');

describe('assertView command', () => {
    const sandbox = sinon.sandbox.create();
    let session, imageStub;

    const mkConfig_ = (opts = {}) => {
        return Object.assign({
            getScreenshotPath: () => '/some/path',
            system: {
                diffColor: '#ffffff',
                tempOpts: {}
            }
        }, opts);
    };

    const assertView = (config) => {
        const browser = mkBrowser_(config);

        sandbox.stub(browser, 'captureViewportImage').resolves(imageStub);

        return session.assertView();
    };

    beforeEach(() => {
        session = mkSessionStub_(sandbox);
        session.executionContext = {};
        sandbox.stub(webdriverio, 'remote').returns(session);
        imageStub = {save: sandbox.stub().named('save')};

        sandbox.stub(Image, 'compare');
        sandbox.stub(Image.prototype, 'save').resolves();
        sandbox.stub(fs, 'existsSync');
        sandbox.stub(temp, 'path');
        sandbox.stub(temp, 'attach');

        sandbox.stub(RuntimeConfig, 'getInstance').returns({tempOpts: {}});
        sandbox.stub(fsExtra, 'copy');
    });

    afterEach(() => sandbox.restore());

    describe('take screenshot', () => {
        let browser;

        beforeEach(() => {
            fs.existsSync.returns(true);
            Image.compare.resolves(true);

            browser = mkBrowser_();
            sandbox.stub(browser, 'captureViewportImage').resolves(imageStub);
        });

        it('should capture viewport image', () => {
            return session.assertView()
                .then(() => assert.calledOnce(browser.captureViewportImage));
        });

        it('should save a captured screenshot', () => {
            temp.path.returns('/curr/path');

            return assertView(mkConfig_())
                .then(() => assert.calledOnceWith(imageStub.save, '/curr/path'));
        });
    });

    describe('assert refs', () => {
        it('should fail with "NoRefImageError" error if there is no reference image', () => {
            fs.existsSync.returns(false);

            return assert.isRejected(assertView(), NoRefImageError);
        });
    });

    describe('update refs', () => {
        beforeEach(() => RuntimeConfig.getInstance.returns({updateRefs: true, tempOpts: {}}));

        it('should be fulfilled if there is not reference image', () => {
            fs.existsSync.returns(false);

            return assert.isFulfilled(assertView());
        });

        it('should update reference image if it does not exist', () => {
            temp.path.returns('/curr/path');

            fs.existsSync.withArgs('/ref/path').returns(false);

            return assertView({getScreenshotPath: () => '/ref/path'})
                .then(() => assert.calledOnceWith(fsExtra.copy, '/curr/path', '/ref/path'));
        });
    });

    describe('image compare', () => {
        beforeEach(() => {
            fs.existsSync.returns(true);
        });

        it('should add opts from runtime config to temp', () => {
            Image.compare.resolves(true);
            RuntimeConfig.getInstance.returns({tempOpts: {some: 'opts'}});

            return assertView(mkConfig_())
                .then(() => assert.calledOnceWith(temp.attach, {some: 'opts', suffix: '.png'}));
        });

        it('should compare a current image with a reference', () => {
            const config = mkConfig_({
                getScreenshotPath: () => '/ref/path',
                tolerance: 100
            });
            Image.compare.resolves(true);
            temp.path.returns('/curr/path');

            return assertView(config)
                .then(() => {
                    assert.calledOnceWith(Image.compare, '/ref/path', '/curr/path', {tolerance: 100});
                });
        });

        describe('if images are not equal', () => {
            beforeEach(() => {
                Image.compare.resolves(false);
                sandbox.stub(Image, 'buildDiff');
            });

            describe('assert refs', () => {
                it('should fail with "ImageDiffError" error', () => {
                    return assert.isRejected(assertView(mkConfig_()), ImageDiffError);
                });

                describe('passing diff options', () => {
                    it('should pass diff options for passed image paths', () => {
                        const config = mkConfig_({getScreenshotPath: () => '/reference/path'});
                        temp.path.returns('/current/path');

                        return assertView(config)
                            .catch((e) => {
                                assert.match(e.diffOpts, {
                                    current: '/current/path',
                                    reference: '/reference/path'
                                });
                            });
                    });

                    it('should pass diff options with passed compare options', () => {
                        const config = {
                            tolerance: 100,
                            system: {diffColor: '#111111'}
                        };

                        return assertView(config)
                            .catch((e) => assert.match(e.diffOpts, {tolerance: 100, diffColor: '#111111'}));
                    });
                });
            });

            describe('update refs', () => {
                beforeEach(() => RuntimeConfig.getInstance.returns({updateRefs: true, tempOpts: {}}));

                it('should be fulfilled', () => {
                    return assert.isFulfilled(assertView());
                });

                it('should update reference image by a current image', () => {
                    temp.path.returns('/cur/path');

                    return assertView({getScreenshotPath: () => '/ref/path'})
                        .then(() => assert.calledOnceWith(fsExtra.copy, '/cur/path', '/ref/path'));
                });
            });
        });
    });
});
