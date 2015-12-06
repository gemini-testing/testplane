'use strict';

var Mocha = require('mocha'),
    ProxyReporter = require('../../../lib/proxy-reporter'),
    SuiteRunner,

    proxyquire = require('proxyquire');

describe('Suite runner', function() {
    var sandbox = sinon.sandbox.create(),
        clearRequire;

    function stubMocha_() {
        sandbox.stub(Mocha.prototype);

        Mocha.prototype.suite = {ctx: {}};
        Mocha.prototype.run.yields();
    }

    function run_(suite, browser, config) {
        return new SuiteRunner(
            config || {},
            browser || {publicAPI: {}}
        ).run(suite || 'test_suite');
    }

    beforeEach(function() {
        stubMocha_();
        clearRequire = sandbox.stub().named('clear-require');

        SuiteRunner = proxyquire('../../../lib/runner/suite-runner', {
            'clear-require': clearRequire
        });
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

        it('should set mocha reporter as proxy reporter in order to proxy events from mocha to runner', function() {
            return run_()
                .then(function() {
                    assert.calledWith(Mocha.prototype.reporter, ProxyReporter);
                });
        });

        it('should clear require cache for test file', function() {
            return run_('path/to/test')
                .then(function() {
                    assert.calledWithMatch(clearRequire, 'path/to/test');
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
