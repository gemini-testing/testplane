'use strict';

const path = require('path');
const proxyquire = require('proxyquire').noCallThru();
const defaults = require('../../../lib/config/defaults');

describe('config', () => {
    const sandbox = sinon.sandbox.create();

    let parseOptions;

    const initConfig = (opts) => {
        opts = opts || {};
        parseOptions = sandbox.stub().returns(opts.configParserReturns);

        const configPath = opts.configPath || defaults.config;
        const resolvedConfigPath = path.resolve(process.cwd(), configPath);
        const Config = proxyquire('../../../lib/config', {
            './options': parseOptions,
            [resolvedConfigPath]: opts.requireConfigReturns || {}
        });

        return Config.create(configPath, opts.allowOverrides);
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

        it('should create config', () => {
            assert.include(initConfig({configParserReturns: {some: 'option'}}), {some: 'option'});
        });

        it('should extend config with a config path', () => {
            assert.include(initConfig({configPath: 'config-path'}), {configPath: 'config-path'});
        });
    });

    describe('forBrowser', () => {
        it('should get config for a browser', () => {
            const config = initConfig({configParserReturns: {browsers: {bro: {some: 'option'}}}});

            assert.include(config.forBrowser('bro'), {some: 'option'});
        });

        it('should extend browser config with its id', () => {
            const config = initConfig({configParserReturns: {browsers: {bro: {some: 'option'}}}});

            assert.include(config.forBrowser('bro'), {id: 'bro'});
        });
    });

    describe('getBrowserIds', () => {
        it('should get browser ids', () => {
            const config = initConfig({configParserReturns: {browsers: {bro1: {}, bro2: {}}}});

            assert.deepEqual(config.getBrowserIds(), ['bro1', 'bro2']);
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
