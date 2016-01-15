'use strict';

var q = require('q'),
    Mocha = require('mocha'),
    ProxyReporter = require('../../../lib/proxy-reporter'),
    BrowserAgent = require('../../../lib/browser-agent'),
    logger = require('../../../lib/utils').logger,
    SuiteRunner,

    proxyquire = require('proxyquire');

describe('Suite runner', function() {
    var sandbox = sinon.sandbox.create(),
        clearRequire;

    function stubMocha_() {
        sandbox.stub(Mocha.prototype);
        Mocha.prototype.run.yields();

        sandbox.stub(Mocha.Suite.prototype);
    }

    function run_(suite) {
        return new SuiteRunner(
            {},
            new BrowserAgent()
        ).run(suite || 'test_suite');
    }

    beforeEach(function() {
        stubMocha_();

        clearRequire = sandbox.stub().named('clear-require');
        SuiteRunner = proxyquire('../../../lib/runner/suite-runner', {
            'clear-require': clearRequire
        });

        sandbox.stub(BrowserAgent.prototype);
        BrowserAgent.prototype.browserId = 'some-default-browser';

        sandbox.stub(logger);
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('run', function() {
        it('should add suite file to mocha', function() {
            return run_('path/to/suite/file')
                .then(function() {
                    assert.calledWith(Mocha.prototype.addFile, 'path/to/suite/file');
                });
        });

        it('should force mocha to pass full trace on errors', function() {
            return run_()
                .then(function() {
                    assert.called(Mocha.prototype.fullTrace);
                });
        });

        it('should clear require cache for test file', function() {
            return run_('path/to/test')
                .then(function() {
                    assert.calledWithMatch(clearRequire, 'path/to/test');
                });
        });

        it('should request browser before suite execution', function() {
            Mocha.Suite.prototype.beforeAll.yields();
            BrowserAgent.prototype.getBrowser.returns(q());

            return run_()
                .then(function() {
                    assert.calledOnce(BrowserAgent.prototype.getBrowser);
                });
        });

        it('should release browser after suite execution', function() {
            var browser = {};

            Mocha.Suite.prototype.beforeAll.yields();

            BrowserAgent.prototype.getBrowser.returns(q(browser));
            BrowserAgent.prototype.freeBrowser.returns(q());

            return run_()
                .then(function() {
                    var afterAll = Mocha.Suite.prototype.afterAll.firstCall.args[0];
                    return afterAll();
                })
                .then(function() {
                    assert.calledOnce(BrowserAgent.prototype.freeBrowser);
                    assert.calledWith(BrowserAgent.prototype.freeBrowser, browser);
                });
        });

        it('should disable mocha timeouts while setting browser hooks', function() {
            Mocha.Suite.prototype.enableTimeouts.onFirstCall().returns(true);

            return run_()
                .then(function() {
                    assert.callOrder(
                        Mocha.Suite.prototype.enableTimeouts, // get current value of enableTimeouts
                        Mocha.Suite.prototype.enableTimeouts.withArgs(false).named('disableTimeouts'),
                        Mocha.Suite.prototype.beforeAll,
                        Mocha.Suite.prototype.afterAll,
                        Mocha.Suite.prototype.enableTimeouts.withArgs(true).named('restoreTimeouts')
                    );
                });
        });

        it('should not be rejected if freeBrowser failed', function() {
            var browser = {};

            Mocha.Suite.prototype.beforeAll.yields();

            BrowserAgent.prototype.getBrowser.returns(q(browser));
            BrowserAgent.prototype.freeBrowser.returns(q.reject('some-error'));

            return run_()
                .then(function() {
                    var afterAll = Mocha.Suite.prototype.afterAll.firstCall.args[0];
                    return assert.isFulfilled(afterAll());
                })
                .then(function() {
                    assert.calledOnce(logger.warn);
                    assert.calledWithMatch(logger.warn, /some-error/);
                });
        });

        it('should set mocha reporter as proxy reporter in order to proxy events from mocha to runner', function() {
            return run_()
                .then(function() {
                    assert.calledWith(Mocha.prototype.reporter, ProxyReporter);
                });
        });

        it('should pass to proxy reporter browser id', function() {
            BrowserAgent.prototype.browserId = 'browser';

            return run_()
                .then(function() {
                    assert.calledWithMatch(Mocha.prototype.reporter, sinon.match.any, {
                        browserId: 'browser'
                    });
                });
        });

        it('should pass to proxy reporter getter for requested browser', function() {
            var browser = {};

            Mocha.Suite.prototype.beforeAll.yields();
            BrowserAgent.prototype.getBrowser.returns(q(browser));

            return run_()
                .then(function() {
                    var getBrowser = Mocha.prototype.reporter.lastCall.args[1].getBrowser;
                    assert.equal(browser, getBrowser());
                });
        });

        it('should run mocha', function() {
            return run_()
                .then(function() {
                    assert.called(Mocha.prototype.run);
                });
        });
    });
});
