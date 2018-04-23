'use strict';

const Runner = require('lib/worker/runner');
const BrowserPool = require('lib/worker/runner/browser-pool');
const MochaAdapter = require('lib/worker/runner/mocha-adapter');
const BrowserAgent = require('lib/worker/runner/browser-agent');
const EventEmitter = require('events').EventEmitter;
const WorkerRunnerEvents = require('lib/worker/constants/runner-events');

describe('worker/runner', () => {
    const sandbox = sinon.sandbox.create();

    const mkMochaAdapterStub = () => {
        const mocha = new EventEmitter();
        mocha.attachTestFilter = sandbox.stub();
        mocha.loadFiles = sandbox.stub();
        mocha.runInSession = sandbox.stub();

        sandbox.stub(MochaAdapter, 'create').returns(mocha);
        return mocha;
    };

    beforeEach(() => {
        sandbox.stub(BrowserPool, 'create').returns({browser: 'pool'});
        sandbox.stub(MochaAdapter, 'prepare');
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should create browser pool', () => {
            Runner.create({foo: 'bar'});

            assert.calledOnceWith(BrowserPool.create, {foo: 'bar'});
        });

        it('should prepare Mocha', () => {
            Runner.create();

            assert.calledOnce(MochaAdapter.prepare);
        });
    });

    describe('runTest', () => {
        let runner;
        let option;
        let mochaAdapter;

        beforeEach(() => {
            sandbox.stub(BrowserAgent, 'create')
                .withArgs('chrome', {browser: 'pool'})
                .returns({browser: 'agent'});
            mochaAdapter = mkMochaAdapterStub();

            const config = {
                system: {system: 'sys'},
                forBrowser: () => ({baz: 'qux'})
            };
            runner = Runner.create(config);
            option = {file: 'file.js', browserId: 'chrome', sessionId: '1234'};
        });

        it('should create mocha adapter with merged system and browser config', () => {
            runner.runTest(null, {});

            assert.calledOnceWith(MochaAdapter.create, sinon.match.any, {
                system: 'sys',
                baz: 'qux'
            });
        });

        it('should filter tests by fullTitle', () => {
            runner.runTest('world', option);

            const tests = ['hello', 'world', 'test'].map((value) => {
                return {fullTitle: () => value};
            });
            const filter = mochaAdapter.attachTestFilter.getCall(0).args[0];
            const result = tests.filter(filter).map((test) => test.fullTitle());

            assert.deepEqual(result, ['world']);
        });

        it('should load files', () => {
            runner.runTest('title', option);

            assert.calledOnceWith(mochaAdapter.loadFiles, 'file.js');
        });

        it('should run test is session', () => {
            runner.runTest('title', option);

            assert.calledOnceWith(mochaAdapter.runInSession, '1234');
        });

        it('should passthrough mochaAdapter events', () => {
            runner.runTest('title', option);

            [
                WorkerRunnerEvents.BEFORE_FILE_READ,
                WorkerRunnerEvents.AFTER_FILE_READ
            ].forEach((event) => {
                const spy = sandbox.spy().named(`${event} handler`);
                runner.on(event, spy);

                mochaAdapter.emit(event);

                assert.calledOnce(spy);
            });
        });
    });
});
