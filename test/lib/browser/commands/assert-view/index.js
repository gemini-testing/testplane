'use strict';

const fs = require('fs');
const fsExtra = require('fs-extra');
const webdriverio = require('@gemini-testing/webdriverio');
const {Image, temp, ScreenShooter} = require('gemini-core');
const ImageDiffError = require('lib/browser/commands/assert-view/errors/image-diff-error');
const NoRefImageError = require('lib/browser/commands/assert-view/errors/no-ref-image-error');
const RuntimeConfig = require('lib/config/runtime-config');
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
        const session = mkSessionStub_();
        session.executionContext = {hermioneCtx: {}};
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
        sandbox.stub(fsExtra, 'copy').resolves();

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

        it('should handle cases when ignore elements option is not passed', () => {
            const browser = stubBrowser_();

            return browser.publicAPI.assertView()
                .then(() => assert.calledOnceWith(browser.prepareScreenshot, sinon.match.any, {ignoreSelectors: []}));
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

    it('should not fail if there is no reference image', () => {
        fs.existsSync.returns(false);

        return assert.isFulfilled(stubBrowser_().publicAPI.assertView());
    });

    it('should remember several "NoRefImageError" errors', () => {
        fs.existsSync.returns(false);

        const browser = stubBrowser_();

        return browser.publicAPI.assertView()
            .then(() => browser.publicAPI.assertView())
            .then(() => {
                const [firstError, secondError] = browser.publicAPI.executionContext.hermioneCtx.assertViewResults.get();
                assert.instanceOf(firstError, NoRefImageError);
                assert.instanceOf(secondError, NoRefImageError);
                assert.notEqual(firstError, secondError);
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

        it('should reject on reference update fail', () => {
            fs.existsSync.returns(false);

            fsExtra.copy.throws();

            return assert.isRejected(stubBrowser_().publicAPI.assertView());
        });
    });

    describe('image compare', () => {
        it('should add opts from runtime config to temp', () => {
            Image.compare.resolves({equal: true});
            RuntimeConfig.getInstance.returns({tempOpts: {some: 'opts'}});

            return stubBrowser_().publicAPI.assertView()
                .then(() => assert.calledOnceWith(temp.attach, {some: 'opts', suffix: '.png'}));
        });

        it('should compare a current image with a reference', () => {
            const config = mkConfig_({getScreenshotPath: () => '/ref/path'});
            Image.compare.resolves({equal: true});
            temp.path.returns('/curr/path');

            return stubBrowser_(config).publicAPI.assertView()
                .then(() => {
                    assert.calledOnceWith(Image.compare, '/ref/path', '/curr/path');
                });
        });

        it('should compare images with given set of parameters', () => {
            const config = mkConfig_({tolerance: 100, antialiasingTolerance: 200, bail: false});
            const browser = stubBrowser_(config);

            browser.prepareScreenshot.resolves({canHaveCaret: 'foo bar', pixelRatio: 300});

            return browser.publicAPI.assertView()
                .then(() => assert.calledOnceWith(
                    Image.compare,
                    sinon.match.any, sinon.match.any,
                    {canHaveCaret: 'foo bar', tolerance: 100, antialiasingTolerance: 200, pixelRatio: 300, bail: false}
                ));
        });

        describe('if images are not equal', () => {
            beforeEach(() => {
                Image.compare.resolves({equal: false});
            });

            describe('assert refs', () => {
                it('should not reject', () => {
                    return assert.isFulfilled(stubBrowser_().publicAPI.assertView());
                });

                it('should remember several "ImageDiffError" errors', () => {
                    const browser = stubBrowser_();

                    return browser.publicAPI.assertView()
                        .then(() => browser.publicAPI.assertView())
                        .then(() => {
                            const [firstError, secondError] = browser.publicAPI.executionContext.hermioneCtx.assertViewResults.get();
                            assert.instanceOf(firstError, ImageDiffError);
                            assert.instanceOf(secondError, ImageDiffError);
                            assert.notEqual(firstError, secondError);
                        });
                });

                describe('passing diff options', () => {
                    it('should pass diff options for passed image paths', () => {
                        const config = mkConfig_({getScreenshotPath: () => '/reference/path'});
                        const browser = stubBrowser_(config);
                        temp.path.returns('/current/path');

                        return browser.publicAPI.assertView()
                            .then(() => {
                                const e = browser.publicAPI.executionContext.hermioneCtx.assertViewResults.get()[0];

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
                        const browser = stubBrowser_(config);

                        return browser.publicAPI.assertView()
                            .then(() => {
                                const e = browser.publicAPI.executionContext.hermioneCtx.assertViewResults.get()[0];

                                assert.match(e.diffOpts, {tolerance: 100, diffColor: '#111111'});
                            });
                    });

                    it('should pass diff bounds to error', () => {
                        Image.compare.resolves({diffBounds: {left: 0, top: 0, right: 10, bottom: 10}});
                        const browser = stubBrowser_();
                        return browser.publicAPI.assertView()
                            .then(() => {
                                const e = browser.publicAPI.executionContext.hermioneCtx.assertViewResults.get()[0];

                                assert.deepEqual(e.diffBounds, {left: 0, top: 0, right: 10, bottom: 10});
                            });
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

    it('should remember several success assert view calls', () => {
        Image.compare.resolves({equal: true});
        const getScreenshotPath = sandbox.stub();

        getScreenshotPath
            .withArgs(sinon.match.any, 'plain').returns('/ref/path/plain')
            .withArgs(sinon.match.any, 'complex').returns('/ref/path/complex');

        const browser = stubBrowser_({getScreenshotPath});

        return browser.publicAPI.assertView('plain')
            .then(() => browser.publicAPI.assertView('complex'))
            .then(() => {
                assert.deepEqual(browser.publicAPI.executionContext.hermioneCtx.assertViewResults.get(), [
                    {stateName: 'plain', refImagePath: '/ref/path/plain'},
                    {stateName: 'complex', refImagePath: '/ref/path/complex'}
                ]);
            });
    });
});
