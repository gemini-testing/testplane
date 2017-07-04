'use strict';

const proxyquire = require('proxyquire');
const q = require('q');

describe('browser-pool/q-browser-pool', () => {
    const sandbox = sinon.sandbox.create();

    const stubBrowserPool = () => {
        return {
            getBrowser: sandbox.stub(),
            freeBrowser: sandbox.stub(),
            cancel: sandbox.stub()
        };
    };

    let QBrowserPool;
    let bluebirdQ;

    beforeEach(() => {
        bluebirdQ = sandbox.stub().returns(q());

        QBrowserPool = proxyquire('../../../lib/browser-pool/q-browser-pool', {'bluebird-q': bluebirdQ});
    });

    afterEach(() => sandbox.restore());

    describe('getBrowser', () => {
        it('should get a browser', () => {
            const browserPool = stubBrowserPool();
            const qBrowserPool = QBrowserPool.create(browserPool);

            return qBrowserPool.getBrowser('bro')
                .then(() => assert.calledOnceWith(browserPool.getBrowser, 'bro'));
        });

        it('should wrap a result into "q" promises', () => {
            const browserPool = stubBrowserPool();
            const qBrowserPool = QBrowserPool.create(browserPool);

            browserPool.getBrowser.returns({some: 'browser'});
            bluebirdQ.withArgs({some: 'browser'}).returns(q({qPromisified: 'browser'}));

            return assert.becomes(qBrowserPool.getBrowser(), {qPromisified: 'browser'});
        });
    });

    describe('freeBrowser', () => {
        it('should free a browser with passed options', () => {
            const browserPool = stubBrowserPool();
            const qBrowserPool = QBrowserPool.create(browserPool);

            return qBrowserPool.freeBrowser({some: 'browser'}, {some: 'options'})
                .then(() => assert.calledOnceWith(browserPool.freeBrowser, {some: 'browser'}, {some: 'options'}));
        });

        it('should wrap a result into "q" promises', () => {
            const browserPool = stubBrowserPool();
            const qBrowserPool = QBrowserPool.create(browserPool);

            browserPool.freeBrowser.returns({some: 'browser'});
            bluebirdQ.withArgs({some: 'browser'}).returns(q({qPromisified: 'browser'}));

            return assert.becomes(qBrowserPool.freeBrowser(), {qPromisified: 'browser'});
        });
    });

    describe('cancel', () => {
        it('should cancel a browser pool', () => {
            const browserPool = stubBrowserPool();
            const qBrowserPool = QBrowserPool.create(browserPool);

            browserPool.cancel.returns({foo: 'bar'});

            assert.deepEqual(qBrowserPool.cancel(), {foo: 'bar'});
            assert.calledOnce(browserPool.cancel);
        });
    });
});
