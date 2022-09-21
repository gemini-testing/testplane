'use strict';

const path = require('path');
const proxyquire = require('proxyquire').noCallThru();
const defaults = require('build/config/defaults');
const BrowserConfig = require('build/config/browser-config');

describe('config', () => {
    const sandbox = sinon.sandbox.create();

    let parseOptions;

    const initConfig = (opts) => {
        opts = opts || {};
        parseOptions = sandbox.stub().returns(opts.configParserReturns);
        const config = opts.config || defaults.config;
        const stubs = {
            './options': parseOptions
        };

        if (typeof config === 'string') {
            const resolvedConfigPath = path.resolve(process.cwd(), config);
            stubs[resolvedConfigPath] = opts.requireConfigReturns || {};
        }
        const Config = proxyquire('../../../build/config', stubs);

        return Config.create(opts.config, opts.allowOverrides);
    };

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should parse options', () => {
            initConfig();

            assert.calledOnce(parseOptions);
        });

        it('should parse config from file', () => {
            initConfig({requireConfigReturns: 'some-options'});

            assert.calledWithMatch(parseOptions, {options: 'some-options', env: process.env, argv: process.argv});
        });

        it('should parse config from object', () => {
            initConfig({config: {someOption: 'some-value'}});

            assert.calledWithMatch(parseOptions, {options: {someOption: 'some-value'}, env: process.env, argv: process.argv});
        });

        it('should create config', () => {
            assert.include(initConfig({configParserReturns: {some: 'option'}}), {some: 'option'});
        });

        it('should extend config with a config path', () => {
            assert.include(initConfig({config: 'config-path'}), {configPath: 'config-path'});
        });

        it('should wrap browser config with "BrowserConfig" instance', () => {
            const config = initConfig({
                configParserReturns: {
                    browsers: {
                        bro1: {}
                    }
                }
            });

            assert.instanceOf(config.forBrowser('bro1'), BrowserConfig);
        });

        it('should extend browser config with its id', () => {
            const config = initConfig({configParserReturns: {browsers: {bro: {some: 'option'}}}});

            assert.include(config.forBrowser('bro'), {id: 'bro'});
        });
    });

    describe('forBrowser', () => {
        it('should get config for a browser', () => {
            const config = initConfig({configParserReturns: {browsers: {bro: {some: 'option'}}}});

            assert.include(config.forBrowser('bro'), {some: 'option'});
        });
    });

    describe('getBrowserIds', () => {
        it('should get browser ids', () => {
            const config = initConfig({configParserReturns: {browsers: {bro1: {}, bro2: {}}}});

            assert.deepEqual(config.getBrowserIds(), ['bro1', 'bro2']);
        });
    });

    describe('serialize', () => {
        it('should delegate browsers serialization to browser config', () => {
            const config = initConfig({configParserReturns: {
                browsers: {
                    bro: {}
                },
                configPath: 'foo/bar/baz'
            }});
            sandbox.stub(BrowserConfig.prototype, 'serialize').returns({foo: 'bar'});

            const result = config.serialize();

            assert.deepEqual(result, {
                browsers: {
                    bro: {foo: 'bar'}
                },
                configPath: 'foo/bar/baz'
            });
        });
    });

    describe('mergeWith', () => {
        it('should deeply merge config with another one', () => {
            const config = initConfig({configParserReturns: {some: {deep: {option: 'foo'}}}});

            config.mergeWith({some: {deep: {option: 'bar'}}});

            assert.deepInclude(config, {some: {deep: {option: 'bar'}}});
        });

        it('should not merge values of different types', () => {
            const config = initConfig({configParserReturns: {option: 100500}});

            config.mergeWith({option: '100500'});

            assert.deepInclude(config, {option: 100500});
        });
    });
});
