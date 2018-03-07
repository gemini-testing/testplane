'use strict';

const fs = require('fs');
const fsExtra = require('fs-extra');
const webdriverio = require('webdriverio');
const {Image, temp, ScreenShooter} = require('gemini-core');
const RuntimeConfig = require('lib/config/runtime-config');
const NoRefImageError = require('lib/browser/commands/assert-view/errors/no-ref-image-error');
const ImageDiffError = require('lib/browser/commands/assert-view/errors/image-diff-error');
const {mkExistingBrowser_: mkBrowser_, mkSessionStub_} = require('../../utils');

describe('assertView command', () => {
    const sandbox = sinon.sandbox.create();

    const mkConfig_ = (opts = {}) => {
        return Object.assign({
            getScreenshotPath: () => '/some/path',
            system: {
                diffColor: '#ffffff',
                tempOpts: {}
            }
        }, opts);
    };

    const stubImage_ = () => ({save: sandbox.stub().named('save')});

    const stubBrowser_ = (config) => {
        const session = mkSessionStub_(sandbox);
        session.executionContext = {};
        sandbox.stub(webdriverio, 'remote').returns(session);

        const browser = mkBrowser_(config);
        sandbox.stub(browser, 'prepareScreenshot').resolves({});
        sandbox.stub(browser, 'captureViewportImage').resolves(stubImage_());

        return browser;
    };

    beforeEach(() => {
        sandbox.stub(Image, 'compare').resolves(true);

        sandbox.stub(fs, 'existsSync').returns(true);

        sandbox.stub(temp, 'path');
        sandbox.stub(temp, 'attach');

        sandbox.stub(RuntimeConfig, 'getInstance').returns({tempOpts: {}});
        sandbox.stub(fsExtra, 'copy');

        sandbox.spy(ScreenShooter, 'create');
        sandbox.stub(ScreenShooter.prototype, 'capture').resolves(stubImage_());
    });

    afterEach(() => sandbox.restore());

    describe('prepare screenshot', () => {
        it('should prepare screenshot for one selector', () => {
            const browser = stubBrowser_();

            return browser.publicAPI.assertView('plain', '.selector')
                .then(() => assert.calledOnceWith(browser.prepareScreenshot, ['.selector']));
        });

        it('should prepare screenshot for several selectors', () => {
            const browser = stubBrowser_();

            return browser.publicAPI.assertView('plain', ['.selector1', '.selector2'])
                .then(() => assert.calledOnceWith(browser.prepareScreenshot, ['.selector1', '.selector2']));
        });

        it('should handle ignore elements option passed as an array', () => {
            const browser = stubBrowser_();

            return browser.publicAPI.assertView(null, null, {ignoreElements: ['foo', 'bar']})
                .then(() => assert.calledOnceWith(browser.prepareScreenshot, sinon.match.any, {ignoreSelectors: ['foo', 'bar']}));
        });

        it('should handle ignore elements option passed as a string', () => {
            const browser = stubBrowser_();

            return browser.publicAPI.assertView(null, null, {ignoreElements: 'foo bar'})
                .then(() => assert.calledOnceWith(browser.prepareScreenshot, sinon.match.any, {ignoreSelectors: ['foo bar']}));
        });
    });

    describe('take screenshot', () => {
        it('should create an instance of a screen shooter', () => {
            const browser = stubBrowser_();

            assert.calledOnceWith(ScreenShooter.create, browser);
        });

        it('should capture a screenshot image', () => {
            const browser = stubBrowser_();

            browser.prepareScreenshot.resolves({foo: 'bar'});

            return browser.publicAPI.assertView()
                .then(() => assert.calledOnceWith(ScreenShooter.prototype.capture, {foo: 'bar'}));
        });

        it('should save a captured screenshot', () => {
            temp.path.returns('/curr/path');

            const browser = stubBrowser_();
            const image = stubImage_();

            ScreenShooter.prototype.capture.resolves(image);

            return browser.publicAPI.assertView()
                .then(() => assert.calledOnceWith(image.save, '/curr/path'));
        });
    });

    describe('assert refs', () => {
        it('should fail with "NoRefImageError" error if there is no reference image', () => {
            fs.existsSync.returns(false);

            return assert.isRejected(stubBrowser_().publicAPI.assertView(), NoRefImageError);
        });
    });

    describe('update refs', () => {
        beforeEach(() => RuntimeConfig.getInstance.returns({updateRefs: true, tempOpts: {}}));

        it('should be fulfilled if there is not reference image', () => {
            fs.existsSync.returns(false);

            return assert.isFulfilled(stubBrowser_().publicAPI.assertView());
        });

        it('should update reference image if it does not exist', () => {
            temp.path.returns('/curr/path');

            fs.existsSync.withArgs('/ref/path').returns(false);

            const browser = stubBrowser_({getScreenshotPath: () => '/ref/path'});

            return browser.publicAPI.assertView()
                .then(() => assert.calledOnceWith(fsExtra.copy, '/curr/path', '/ref/path'));
        });
    });

    describe('image compare', () => {
        it('should add opts from runtime config to temp', () => {
            Image.compare.resolves(true);
            RuntimeConfig.getInstance.returns({tempOpts: {some: 'opts'}});

            return stubBrowser_().publicAPI.assertView()
                .then(() => assert.calledOnceWith(temp.attach, {some: 'opts', suffix: '.png'}));
        });

        it('should compare a current image with a reference', () => {
            const config = mkConfig_({
                getScreenshotPath: () => '/ref/path',
                tolerance: 100
            });
            Image.compare.resolves(true);
            temp.path.returns('/curr/path');

            return stubBrowser_(config).publicAPI.assertView()
                .then(() => {
                    assert.calledOnceWith(Image.compare, '/ref/path', '/curr/path', sinon.match({tolerance: 100}));
                });
        });

        it('should pass "canHaveCaret" option to compare function', () => {
            const browser = stubBrowser_();

            browser.prepareScreenshot.resolves({canHaveCaret: 'foo bar'});

            return browser.publicAPI.assertView()
                .then(() => assert.calledOnceWith(Image.compare, sinon.match.any, sinon.match.any, sinon.match({canHaveCaret: 'foo bar'})));
        });

        describe('if images are not equal', () => {
            beforeEach(() => {
                Image.compare.resolves(false);
                sandbox.stub(Image, 'buildDiff');
            });

            describe('assert refs', () => {
                it('should fail with "ImageDiffError" error', () => {
                    return assert.isRejected(stubBrowser_().publicAPI.assertView(), ImageDiffError);
                });

                describe('passing diff options', () => {
                    it('should pass diff options for passed image paths', () => {
                        const config = mkConfig_({getScreenshotPath: () => '/reference/path'});
                        temp.path.returns('/current/path');

                        return stubBrowser_(config).publicAPI.assertView()
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

                        return stubBrowser_(config).publicAPI.assertView()
                            .catch((e) => assert.match(e.diffOpts, {tolerance: 100, diffColor: '#111111'}));
                    });
                });
            });

            describe('update refs', () => {
                beforeEach(() => RuntimeConfig.getInstance.returns({updateRefs: true, tempOpts: {}}));

                it('should be fulfilled', () => {
                    return assert.isFulfilled(stubBrowser_().publicAPI.assertView());
                });

                it('should update reference image by a current image', () => {
                    temp.path.returns('/cur/path');

                    return stubBrowser_({getScreenshotPath: () => '/ref/path'}).publicAPI.assertView()
                        .then(() => assert.calledOnceWith(fsExtra.copy, '/cur/path', '/ref/path'));
                });
            });
        });
    });
});
