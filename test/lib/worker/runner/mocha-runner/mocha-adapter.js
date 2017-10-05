'use strict';

const _ = require('lodash');
const q = require('q');
const proxyquire = require('proxyquire');
const BrowserAgent = require('gemini-core').BrowserAgent;
const MochaStub = require('../../../_mocha');

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
        MochaAdapter = proxyquire('../../../../../lib/worker/runner/mocha-runner/mocha-adapter', {
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
});
