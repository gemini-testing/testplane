'use strict';
var q = require('q'),
    Browser = require('../../../lib/browser'),
    BasicPool = require('../../../lib/browser-pool/basic-pool'),
    browserWithId = require('../../utils').browserWithId;

describe('Unlimited pool', function() {
    var sandbox = sinon.sandbox.create(),
        browser,
        config,
        pool,
        requestBrowser = function() {
            return pool.getBrowser('id');
        };

    beforeEach(function() {
        browser = sandbox.stub(browserWithId('id'));
        browser.init.returns(q(browser));
        browser.quit.returns(q(browser));

        sandbox.stub(Browser.prototype, '__constructor')
            .returns(browser);

        config = {
            browsers: {
                id: {
                    capabilities: {browserName: 'id'}
                }
            }
        };

        pool = new BasicPool(config);
    });

    afterEach(function() {
        sandbox.restore();
    });

    it('should create new browser when requested', function() {
        return requestBrowser()
            .then(function() {
                assert.calledWith(Browser.prototype.__constructor, config);
            });
    });

    it('should init a browser', function() {
        return requestBrowser()
            .then(function() {
                assert.calledOnce(browser.init);
            });
    });

    it('should quit a browser when freed', function() {
        return requestBrowser()
            .then(function(browser) {
                return pool.freeBrowser(browser);
            })
            .then(function() {
                assert.calledOnce(browser.quit);
            });
    });
});
