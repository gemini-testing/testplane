'use strict';

const {BrowserPool: CoreBrowserPool} = require('gemini-core');
const _ = require('lodash');
const Promise = require('bluebird');
const AsyncEmitter = require('gemini-core').events.AsyncEmitter;
const BrowserPool = require('../../../lib/browser-pool');
const Browser = require('../../../lib/browser/new-browser');
const Events = require('../../../lib/constants/runner-events');
const makeConfigStub = require('../../utils').makeConfigStub;

describe('browser-pool', () => {
    const sandbox = sinon.sandbox.create();

    beforeEach(() => {
        sandbox.stub(CoreBrowserPool, 'create');
        sandbox.stub(Browser, 'create');
    });

    afterEach(() => sandbox.restore());

    describe('create', () => {
        it('should create browser pool', () => {
            BrowserPool.create();

            assert.calledOnce(CoreBrowserPool.create);
            assert.calledWithMatch(CoreBrowserPool.create, sinon.match.any, {logNamespace: 'hermione'});
        });

        it('should wrap browser pool into "q" promises', () => {
            CoreBrowserPool.create.returns({foo: 'bar'});

            assert.deepEqual(BrowserPool.create(), {foo: 'bar'});
        });

        describe('browser manager', () => {
            const getBrowserManager = () => CoreBrowserPool.create.lastCall.args[0];
            const stubBrowser = ({id, sessionId, publicAPI} = {}) => {
                return {
                    id,
                    sessionId,
                    publicAPI,
                    init: sandbox.stub(),
                    quit: sandbox.stub()
                };
            };

            it('should create a browser', () => {
                Browser.create.withArgs({some: 'config'}, 'bro').returns({some: 'browser'});

                BrowserPool.create({some: 'config'});

                assert.deepEqual(getBrowserManager().create('bro'), {some: 'browser'});
            });

            it('should start a browser', () => {
                BrowserPool.create();

                const browser = stubBrowser();
                browser.init.resolves({session: 'id'});

                assert.becomes(getBrowserManager().start(browser), {session: 'id'});
            });

            _.forEach({onStart: Events.SESSION_START, onQuit: Events.SESSION_END}, (event, method) => {
                describe(`${method}`, () => {
                    it(`should emit browser event "${event}"`, () => {
                        const emitter = new AsyncEmitter();
                        const onEvent = sandbox.spy();

                        BrowserPool.create(null, emitter);

                        const BrowserManager = getBrowserManager();

                        emitter.on(event, onEvent);

                        const browser = stubBrowser({
                            id: 'bro',
                            sessionId: '100500',
                            publicAPI: {public: 'api'}
                        });

                        return BrowserManager[method](browser)
                            .then(() => assert.calledOnceWith(onEvent, {public: 'api'}, {browserId: 'bro', sessionId: '100500'}));
                    });

                    it('should wait all async listeners', () => {
                        const emitter = new AsyncEmitter();
                        const onEvent = sandbox.stub().callsFake(() => Promise.delay(1).then(() => ({foo: 'bar'})));

                        BrowserPool.create(null, emitter);

                        const BrowserManager = getBrowserManager();

                        emitter.on(event, onEvent);

                        return assert.becomes(BrowserManager[method](stubBrowser()), [{foo: 'bar'}]);
                    });
                });
            });

            it('should quit a browser', () => {
                const browser = stubBrowser();

                browser.quit.resolves({foo: 'bar'});

                BrowserPool.create();

                assert.becomes(getBrowserManager().quit(browser), {foo: 'bar'});
            });
        });

        describe('adapter config', () => {
            const getAdapterConfig = () => CoreBrowserPool.create.lastCall.args[1].config;

            it('should return config for a browser', () => {
                const configStub = makeConfigStub({
                    browsers: ['bro'],
                    sessionsPerBrowser: 777,
                    testsPerSession: 999
                });

                BrowserPool.create(configStub);

                assert.deepEqual(getAdapterConfig().forBrowser('bro'), {parallelLimit: 777, sessionUseLimit: 999});
            });

            it('should return all browser ids', () => {
                BrowserPool.create(makeConfigStub({browsers: ['bro1', 'bro2']}));

                assert.deepEqual(getAdapterConfig().getBrowserIds(), ['bro1', 'bro2']);
            });

            it('should return a system section of a config', () => {
                BrowserPool.create(makeConfigStub({system: {foo: 'bar'}}));

                assert.deepEqual(getAdapterConfig().system, {foo: 'bar'});
            });
        });
    });
});
