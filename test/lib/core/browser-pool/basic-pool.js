'use strict';

const BasicPool = require('lib/core/browser-pool/basic-pool');
const CancelledError = require('lib/core/errors/cancelled-error');
const stubBrowser = require('./util').stubBrowser;
const _ = require('lodash');
const Promise = require('bluebird');

describe('browser-pool/basic-pool', () => {
    const sandbox = sinon.sandbox.create();

    const stubBrowserManager_ = () => {
        return {
            create: sinon.stub().callsFake((id) => stubBrowser(id)),
            start: sinon.stub().returns(Promise.resolve()),
            onStart: sinon.stub().returns(Promise.resolve()),
            onQuit: sinon.stub().returns(Promise.resolve()),
            quit: sinon.stub().returns(Promise.resolve())
        };
    };

    const mkPool_ = (opts) => {
        opts = _.defaults(opts, {
            browserManager: stubBrowserManager_()
        });

        return BasicPool.create(opts.browserManager, {});
    };

    afterEach(() => sandbox.restore());

    it('should create new browser when requested', () => {
        const browserManager = stubBrowserManager_();
        const pool = mkPool_({browserManager});

        return pool.getBrowser('broId')
            .then(() => assert.calledWith(browserManager.create, 'broId'));
    });

    it('should create new browser with specified version when requested', () => {
        const browserManager = stubBrowserManager_();
        const pool = mkPool_({browserManager});

        return pool.getBrowser('broId', {version: '1.0'})
            .then(() => assert.calledWith(browserManager.create, 'broId', '1.0'));
    });

    it('should launch a browser', () => {
        const browser = stubBrowser();
        const browserManager = stubBrowserManager_();
        browserManager.create.returns(browser);
        const pool = mkPool_({browserManager});

        return pool.getBrowser()
            .then(() => {
                assert.calledOnceWith(browserManager.start);
                assert.calledWith(browserManager.start, browser);
            });
    });

    it('should not finalize browser if failed to start it', async () => {
        const publicAPI = null;
        const browser = stubBrowser('some-id', 'some-version', publicAPI);

        const browserManager = stubBrowserManager_();
        browserManager.create.returns(browser);
        browserManager.start.rejects();

        const pool = mkPool_({browserManager});

        await assert.isRejected(pool.getBrowser());

        assert.notCalled(browserManager.quit);
    });

    it('should finalize browser if failed after start it', async () => {
        const publicAPI = {};
        const browser = stubBrowser('some-id', 'some-version', publicAPI);

        const browserManager = stubBrowserManager_();
        browserManager.create.returns(browser);
        browserManager.onStart.rejects();

        const pool = mkPool_({browserManager});

        await assert.isRejected(pool.getBrowser());

        assert.calledOnceWith(browserManager.quit, browser);
    });

    describe('onStart', () => {
        it('should be called after browser start', () => {
            const browser = stubBrowser();

            const browserManager = stubBrowserManager_();
            browserManager.create.returns(browser);

            const pool = mkPool_({browserManager});

            return pool.getBrowser()
                .then(() => {
                    assert.calledOnce(browserManager.onStart);
                    assert.calledWith(browserManager.onStart, browser);
                    assert.callOrder(browserManager.start, browserManager.onStart);
                });
        });

        it('handler should be waited by pool', () => {
            const browser = stubBrowser();
            const afterSessionStart = sinon.spy();

            const browserManager = stubBrowserManager_();
            browserManager.create.returns(browser);
            browserManager.onStart.callsFake(() => Promise.delay(10).then(afterSessionStart));

            const pool = mkPool_({browserManager});

            return pool.getBrowser()
                .then(() => assert.callOrder(afterSessionStart, browser.reset));
        });

        it('handler fail should fail browser request', () => {
            const browserManager = stubBrowserManager_();
            browserManager.onStart.rejects(new Error('some-error'));

            const pool = mkPool_({browserManager});

            return assert.isRejected(pool.getBrowser(), 'some-error');
        });

        it('on handler fail browser should be finalized', () => {
            const browser = stubBrowser();

            const browserManager = stubBrowserManager_();
            browserManager.create.returns(browser);
            browserManager.onStart.rejects(new Error());

            const pool = mkPool_({browserManager});

            return assert.isRejected(pool.getBrowser())
                .then(() => {
                    assert.calledOnce(browserManager.quit);
                    assert.calledWith(browserManager.quit, browser);
                });
        });
    });

    it('should quit a browser when freed', () => {
        const browser = stubBrowser();

        const browserManager = stubBrowserManager_();
        browserManager.create.returns(browser);

        const pool = mkPool_({browserManager});

        return pool.getBrowser()
            .then((browser) => pool.freeBrowser(browser))
            .then(() => {
                assert.calledOnce(browserManager.quit);
                assert.calledWith(browserManager.quit, browser);
            });
    });

    describe('onQuit', () => {
        it('should be emitted before browser quit', () => {
            const browser = stubBrowser();

            const browserManager = stubBrowserManager_();
            browserManager.create.returns(browser);

            const pool = mkPool_({browserManager});

            return pool.getBrowser()
                .then((browser) => pool.freeBrowser(browser))
                .then(() => {
                    assert.calledOnce(browserManager.onQuit);
                    assert.calledWith(browserManager.onQuit, browser);
                    assert.callOrder(browserManager.onQuit, browserManager.quit);
                });
        });

        it('handler should be waited before actual quit', () => {
            const beforeSessionQuit = sinon.spy();

            const browserManager = stubBrowserManager_();
            browserManager.onQuit.callsFake(() => Promise.delay(10).then(beforeSessionQuit));

            const pool = mkPool_({browserManager});

            return pool.getBrowser()
                .then((browser) => pool.freeBrowser(browser))
                .then(() => assert.callOrder(beforeSessionQuit, browserManager.quit));
        });

        it('handler fail should not prevent browser from quit', () => {
            const browserManager = stubBrowserManager_();
            browserManager.onQuit.rejects(new Error());

            const pool = mkPool_({browserManager});

            return pool.getBrowser()
                .then((browser) => pool.freeBrowser(browser))
                .then(() => assert.calledOnce(browserManager.quit));
        });
    });

    describe('cancel', () => {
        it('should quit all browsers on cancel', () => {
            const browserManager = stubBrowserManager_();
            const pool = mkPool_({browserManager});

            return Promise
                .all([
                    pool.getBrowser('bro1'),
                    pool.getBrowser('bro2')
                ])
                .spread((bro1, bro2) => {
                    pool.cancel();

                    assert.calledTwice(browserManager.quit);
                    assert.calledWith(browserManager.quit, bro1);
                    assert.calledWith(browserManager.quit, bro2);
                });
        });

        it('should quit all browser with the same id on cancel', () => {
            const browserManager = stubBrowserManager_();
            const pool = mkPool_({browserManager});

            return Promise
                .all([
                    pool.getBrowser('bro'),
                    pool.getBrowser('bro')
                ])
                .spread((bro1, bro2) => {
                    pool.cancel();

                    assert.calledTwice(browserManager.quit);
                    assert.calledWith(browserManager.quit, bro1);
                    assert.calledWith(browserManager.quit, bro2);
                });
        });

        it('should reject all subsequent reqests for browser', () => {
            const pool = mkPool_();

            pool.cancel();

            return assert.isRejected(pool.getBrowser(), CancelledError);
        });

        it('should quit browser once if it was launched after cancel', () => {
            const browserManager = stubBrowserManager_();
            const pool = mkPool_({browserManager});

            pool.cancel();

            return pool.getBrowser()
                .catch(() => assert.calledOnce(browserManager.quit));
        });

        it('should quit browsers only once', () => {
            const browserManager = stubBrowserManager_();
            const pool = mkPool_({browserManager});

            return pool.getBrowser()
                .then(() => pool.cancel())
                .then(() => pool.cancel())
                .then(() => assert.calledOnce(browserManager.quit));
        });
    });
});
