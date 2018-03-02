'use strict';

const Runner = require('lib/worker/runner');
const MochaAdapter = require('lib/worker/runner/mocha-adapter');

describe('worker/runner', () => {
    const sandbox = sinon.sandbox.create();

    beforeEach(() => {
        sandbox.stub(MochaAdapter, 'create').returns(Object.create(MochaAdapter.prototype));
        sandbox.stub(MochaAdapter.prototype);
    });

    afterEach(() => sandbox.restore());

    it('TODO');

    describe('runTest', () => {
        it('should create mocha adapter with merged system and browser config', () => {
            const config = {
                system: {foo: 'bar'},
                forBrowser: () => ({baz: 'qux'})
            };
            const runner = Runner.create(config);

            runner.runTest(null, {});

            assert.calledOnceWith(MochaAdapter.create, sinon.match.any, {
                foo: 'bar',
                baz: 'qux'
            });
        });
    });
});
