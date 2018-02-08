'use strict';

const _ = require('lodash');
const q = require('q');
const proxyquire = require('proxyquire');
const BrowserAgent = require('gemini-core').BrowserAgent;
const RunnerEvents = require('lib/constants/runner-events');
const MochaStub = require('../../_mocha');

describe('worker/mocha-adapter', () => {
    let MochaAdapter;

    const mkBrowserStub_ = (opts) => {
        return _.defaults(opts || {}, {
            publicAPI: Object.create({}),
            updateChanges: sinon.stub()
        });
    };

    const mkMochaAdapter_ = (config) => {
        const browserAgent = sinon.createStubInstance(BrowserAgent);
        browserAgent.getBrowser.returns(mkBrowserStub_());
        browserAgent.freeBrowser.returns(q());

        return MochaAdapter.create(browserAgent, _.extend({patternsOnReject: []}, config));
    };

    beforeEach(() => {
        MochaAdapter = proxyquire(require.resolve('lib/worker/runner/mocha-adapter'), {
            'mocha': MochaStub
        });
    });

    it('TODO');

    describe('inject contexts', () => {
        it('should extend test with hermione context', () => {
            const mochaAdapter = mkMochaAdapter_();
            const test = new MochaStub.Test();
            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

            return mochaAdapter.runInSession()
                .then((data) => assert.property(data, 'hermioneCtx'));
        });
    });

    describe('runInSession', () => {
        it('should return test error on test fail', () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest({fn: () => mochaAdapter.emit(RunnerEvents.TEST_FAIL, {err: new Error('test fail')})});
            });

            return assert.isRejected(mochaAdapter.runInSession(), /test fail/);
        });

        it('should return hook error on afterEach hook fail', () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest()
                    .afterEach(() => mochaAdapter.emit(RunnerEvents.ERROR, new Error('hook fail')));
            });

            return assert.isRejected(mochaAdapter.runInSession(), /hook fail/);
        });

        it('should return test error if both test and afterEach hook failed', () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest({fn: () => mochaAdapter.emit(RunnerEvents.TEST_FAIL, {err: new Error('test fail')})})
                    .afterEach(() => mochaAdapter.emit(RunnerEvents.ERROR, new Error('hook fail')));
            });

            return assert.isRejected(mochaAdapter.runInSession(), /test fail/);
        });
    });
});
