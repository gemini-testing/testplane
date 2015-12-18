'use strict';

var _ = require('lodash'),
    q = require('q'),
    EventEmitter = require('events').EventEmitter,
    Browser = require('../../../lib/browser'),
    BrowserPool = require('../../../lib/browser-pool'),
    BrowserRunner = require('../../../lib/runner/browser-runner'),
    SuiteRunner = require('../../../lib/runner/suite-runner'),

    createConfig = require('../../utils').createConfg,

    RunnerEvents = require('../../../lib/constants/runner-events');

describe('Browser runner', function() {
    var sandbox = sinon.sandbox.create(),
        config,
        browserPool;

    function run_(opts) {
        opts = _.defaults(opts || {}, {
            browserId: 'browser',
            suites: ['suite'],
            browserPool: browserPool
        });

        return new BrowserRunner(
            createConfig(opts.browserId, opts.suites),
            opts.browserId,
            opts.browserPool
        ).run();
    }

    beforeEach(function() {
        sandbox.stub(SuiteRunner.prototype);
        SuiteRunner.prototype.run.returns(q.resolve());

        browserPool = sinon.createStubInstance(BrowserPool);
        browserPool.getBrowser.returns(q.resolve());
        browserPool.freeBrowser.returns(q.resolve());

        config = createConfig('browser', 'spec1');
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('run', function() {
        it('should emit `RunnerEvents.BROWSER_START` event', function() {
            var onBrowserStart = sandbox.spy().named('onBrowserStart'),
                browserRunner = new BrowserRunner(config, 'browser', browserPool);

            browserRunner.on(RunnerEvents.BROWSER_START, onBrowserStart);

            return browserRunner.run()
                .then(function() {
                    assert.calledWith(onBrowserStart, 'browser');
                });
        });

        it('should emit `RunnerEvents.BROWSER_END` event', function() {
            var onBrowserEnd = sandbox.spy().named('onBrowserEnd'),
                browserRunner = new BrowserRunner(config, 'browser', browserPool);

            browserRunner.on(RunnerEvents.BROWSER_END, onBrowserEnd);

            return browserRunner.run()
                .then(function() {
                    assert.calledWith(onBrowserEnd, 'browser');
                });
        });

        it('should emit events in correct order', function() {
            var onBrowserStart = sandbox.spy().named(onBrowserStart),
                onBrowserEnd = sandbox.spy().named('onBrowserEnd'),
                browserRunner = new BrowserRunner(config, 'browser', browserPool);

            browserRunner.on(RunnerEvents.BROWSER_START, onBrowserStart);
            browserRunner.on(RunnerEvents.BROWSER_END, onBrowserEnd);

            return browserRunner.run()
                .then(function() {
                    assert.callOrder(onBrowserStart, onBrowserEnd);
                });
        });

        it('should get browser from browser pool', function() {
            return run_({
                    browserId: 'browser',
                    browserPool: browserPool
                })
                .then(function() {
                    assert.called(browserPool.getBrowser, 'browser');
                });
        });

        it('should return browser to pool when all specs finished', function() {
            var browser = sinon.createStubInstance(Browser);

            browserPool.getBrowser.returns(q.resolve(browser));

            return run_({
                    browserId: 'browser',
                    browserPool: browserPool
                })
                .then(function() {
                    assert.called(browserPool.getBrowser, browser);
                });
        });

        it('should run all suite runners', function() {
            return run_({suites: ['path/to/suite', 'path/to/another/suite']})
                .then(function() {
                    assert.calledTwice(SuiteRunner.prototype.run);
                });
        });

        it('should wait until all suite runners will finish', function() {
            var firstResolveMarker = sandbox.stub().named('First resolve marker'),
                secondResolveMarker = sandbox.stub().named('Second resolve marker');

            SuiteRunner.prototype.run.onFirstCall().returns(q.resolve().then(firstResolveMarker));
            SuiteRunner.prototype.run.onSecondCall().returns(q.delay(1).then(secondResolveMarker));

            return run_({suites: ['path/to/suite', 'path/to/another/suite']})
                .then(function() {
                    assert.called(firstResolveMarker);
                    assert.called(secondResolveMarker);
                });
        });

        it('should be rejected if one of browser runners rejected', function() {
            SuiteRunner.prototype.run.returns(q.reject());

            return assert.isRejected(run_());
        });
    });

    it('should passthrough events from browser runners', function() {
        var emitter = new EventEmitter();

        emitter.run = sandbox.stub().returns(q.resolve());
        SuiteRunner.prototype.__constructor.returns(emitter);

        var browserRunner = new BrowserRunner(config, 'browser', browserPool),
            onTestPass = sandbox.spy().named('onTestPass');

        browserRunner.on(RunnerEvents.TEST_PASS, onTestPass);

        return browserRunner.run().then(function() {
            emitter.emit(RunnerEvents.TEST_PASS);
            assert.called(onTestPass);
        });
    });
});
