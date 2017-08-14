'use strict';

const q = require('q');
const Config = require('../../../lib/config');
const worker = require('../../../lib/worker');
const Hermione = require('../../../lib/worker/hermione');

describe('worker', () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => sandbox.restore());

    beforeEach(() => sandbox.stub(Config, 'create').returns({}));

    describe('init', () => {
        beforeEach(() => {
            sandbox.spy(Hermione, 'create');
            sandbox.stub(Hermione.prototype, 'init');
        });

        it('should init hermione instance', () => {
            worker.init({bro: ['file']}, 'some-config-path.js', () => {});

            assert.calledOnceWith(Hermione.create, 'some-config-path.js');
            assert.calledOnceWith(Hermione.prototype.init, {bro: ['file']});
        });

        it('should call callback without arguments if init ends successfully', () => {
            const cb = sandbox.spy().named('cb');

            worker.init(null, null, cb);

            assert.calledOnce(cb);
            assert.calledWithExactly(cb);
        });

        it('should call callback with an error as the first argument if init fails', () => {
            const cb = sandbox.spy().named('cb');
            const err = new Error();

            Hermione.prototype.init.throws(err);

            worker.init(null, null, cb);

            assert.calledOnceWith(cb, err);
        });

        it('should call callback after init', () => {
            const cb = sandbox.spy().named('cb');

            worker.init(null, null, cb);

            assert.callOrder(Hermione.prototype.init, cb);
        });
    });

    describe('syncConfig', () => {
        it('should sync passed config with a config of inited hermione', () => {
            const config = {mergeWith: sandbox.stub()};

            Config.create.returns(config);

            worker.init(null, null, () => {});
            worker.syncConfig({some: 'config'}, () => {});

            assert.calledOnceWith(config.mergeWith, {some: 'config'});
        });

        it('should call callback after merge', () => {
            const cb = sandbox.spy().named('cb');
            const config = {mergeWith: sandbox.stub()};

            Config.create.returns(config);

            worker.init(null, null, () => {});

            worker.syncConfig({some: 'config'}, cb);

            assert.callOrder(config.mergeWith, cb);
        });
    });

    describe('runTest', () => {
        beforeEach(() => sandbox.stub(Hermione.prototype, 'runTest').returns(q()));

        it('should run a test', () => {
            worker.init(null, null, () => {});

            worker.runTest('fullTitle', {some: 'options'}, () => {});

            assert.calledOnceWith(Hermione.prototype.runTest, 'fullTitle', {some: 'options'});
        });

        it('should call callback without arguments if running of a test ends successfully', () => {
            const cb = sandbox.spy().named('cb');

            worker.init(null, null, () => {});

            worker.runTest(null, null, cb);

            return q.delay(1)
                .then(() => {
                    assert.calledOnce(cb);
                    assert.calledWithExactly(cb);
                });
        });

        it('should call callback with an error as the first argument if running of a test fails', () => {
            const err = new Error();
            const cb = sandbox.spy().named('cb');

            Hermione.prototype.runTest.returns(q.reject(err));

            worker.runTest(null, null, cb);

            return q.delay(1)
                .then(() => assert.calledOnceWith(cb, err));
        });
    });
});
