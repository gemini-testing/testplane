'use strict';

const q = require('q');
const _ = require('lodash');
const Config = require('lib/config');
const RuntimeConfig = require('lib/config/runtime-config');
const worker = require('bluebird').promisifyAll(require('../../../lib/worker'), {suffix: '_'});
const Hermione = require('lib/worker/hermione');

describe('worker', () => {
    const sandbox = sinon.sandbox.create();

    beforeEach(() => {
        sandbox.stub(Config, 'create').returns({});
        sandbox.stub(Hermione.prototype, 'init');
        sandbox.stub(RuntimeConfig, 'getInstance').returns({extend: sandbox.stub()});
    });

    afterEach(() => sandbox.restore());

    describe('init', () => {
        beforeEach(() => {
            sandbox.spy(Hermione, 'create');
        });

        it('should init hermione instance', () => {
            return worker.init_({bro: ['file']}, 'some-config-path.js', {})
                .then(() => {
                    assert.calledOnceWith(Hermione.create, 'some-config-path.js');
                    assert.calledOnceWith(Hermione.prototype.init, {bro: ['file']});
                });
        });

        it('should init runtime config', () => {
            return worker.init_(null, null, {runtime: 'config'})
                .then(() => {
                    assert.calledOnce(RuntimeConfig.getInstance);
                    assert.calledOnceWith(RuntimeConfig.getInstance.lastCall.returnValue.extend, {runtime: 'config'});
                });
        });

        it('should return no result if init ends successfully', () => {
            return worker.init_(null, null, null)
                .then((res) => assert.isUndefined(res));
        });

        it('should passthrough hermione init rejection error', () => {
            Hermione.prototype.init.throws(new Error('o.O'));

            return assert.isRejected(worker.init_(null, null, null), 'o.O');
        });
    });

    describe('syncConfig', () => {
        const stubConfig = (opts) => _.defaults(opts || {}, {mergeWith: sandbox.stub(), system: {mochaOpts: {}}});
        const syncConfig = (config) => {
            return worker.init_(null, null, null)
                .then(() => worker.syncConfig_(config));
        };

        it('should sync passed config with a config of inited hermione', () => {
            const config = stubConfig();

            Config.create.returns(config);

            return syncConfig(stubConfig({some: 'config'}))
                .then(() => {
                    assert.calledOnce(config.mergeWith);
                    assert.calledWithMatch(config.mergeWith, {some: 'config'});
                });
        });

        it('should sync all mocha opts except grep', () => {
            const config = stubConfig();

            Config.create.returns(config);

            return syncConfig({system: {mochaOpts: {grep: 'foo', timeout: 10}}})
                .then(() => assert.deepEqual(
                    config.mergeWith.firstCall.args[0],
                    {system: {mochaOpts: {timeout: 10}}}
                ));
        });
    });

    describe('runTest', () => {
        beforeEach(() => {
            sandbox.stub(Hermione.prototype, 'runTest').returns(q());
        });

        it('should run a test', () => {
            return worker.init_(null, null, null)
                .then(() => worker.runTest('fullTitle', {some: 'options'}))
                .then(() => assert.calledOnceWith(Hermione.prototype.runTest, 'fullTitle', {some: 'options'}));
        });

        it('should resolve with data if running of a test ends successfully', () => {
            Hermione.prototype.runTest.returns(q({some: 'data'}));

            return worker.init_(null, null, null)
                .then(() => worker.runTest_(null, null))
                .then((res) => assert.deepEqual(res, {some: 'data'}));
        });

        it('should reject with data if running of a test fails', () => {
            const data = {err: new Error('o.O')};

            Hermione.prototype.runTest.returns(q.reject(data));

            return worker.init_(null, null, null)
                .then(() => worker.runTest_(null, null))
                .then(
                    () => assert(false, 'should be rejected'),
                    (err) => assert.equal(err, data)
                );
        });
    });
});
