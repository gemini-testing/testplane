'use strict';

const _ = require('lodash');
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
        const stubConfig = (opts) => _.defaults(opts || {}, {mergeWith: sandbox.stub(), system: {mochaOpts: {}}});
        const syncConfig = (config, cb) => {
            worker.init(null, null, () => {});
            worker.syncConfig(config, cb || (() => {}));
        };

        it('should sync passed config with a config of inited hermione', () => {
            const config = stubConfig();

            Config.create.returns(config);

            syncConfig(stubConfig({some: 'config'}));

            assert.calledOnce(config.mergeWith);
            assert.calledWithMatch(config.mergeWith, {some: 'config'});
        });

        it('should sync all mocha opts except grep', () => {
            const config = stubConfig();

            Config.create.returns(config);

            syncConfig({system: {mochaOpts: {grep: 'foo', timeout: 10}}});

            assert.deepEqual(
                config.mergeWith.firstCall.args[0],
                {system: {mochaOpts: {timeout: 10}}}
            );
        });

        it('should call callback after merge', () => {
            const cb = sandbox.spy().named('cb');
            const config = stubConfig();

            Config.create.returns(config);

            syncConfig(stubConfig(), cb);

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

        it('should call callback with data as the second argument if running of a test ends successfully', () => {
            const cb = sandbox.spy().named('cb');

            Hermione.prototype.runTest.returns(q({some: 'data'}));

            worker.init(null, null, () => {});

            worker.runTest(null, null, cb);

            return q.delay(1)
                .then(() => assert.calledOnceWith(cb, null, {some: 'data'}));
        });

        it('should call callback with data as the first argument if running of a test fails', () => {
            const data = {err: new Error()};
            const cb = sandbox.spy().named('cb');

            Hermione.prototype.runTest.returns(q.reject(data));

            worker.runTest(null, null, cb);

            return q.delay(1)
                .then(() => assert.calledOnceWith(cb, data));
        });
    });
});
