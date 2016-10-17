'use strict';

const _ = require('lodash');
const path = require('path');
const proxyquire = require('proxyquire').noCallThru();

const Config = require('../../../lib/config');

describe('config', () => {
    const sandbox = sinon.sandbox.create();

    let configStub;
    let parseOptions;

    beforeEach(() => {
        parseOptions = sandbox.stub();

        configStub = proxyquire('../../../lib/config', {
            './options': parseOptions
        });

        sandbox.stub(configStub, 'read');
    });

    afterEach(() => sandbox.restore());

    it('should read config file', () => {
        configStub.create();

        assert.calledOnce(configStub.read);
    });

    it('should merge parsed config and cli options', () => {
        parseOptions.returns({test: {prop1: 'val1'}});
        const cliOpts = {test: {prop2: 'val2'}};

        const config = configStub.create('configPath', cliOpts);

        assert.deepEqual(config.test, {prop1: 'val1', prop2: 'val2'});
    });

    describe('read', () => {
        const readConfig_ = (configPath, configFromFile) => {
            const resolvedConfigPath = path.resolve(process.cwd(), configPath);

            configStub = proxyquire('../../../lib/config', {
                [resolvedConfigPath]: configFromFile || {}
            });

            return configStub.read(configPath);
        };

        it('should call prepareEnvironment function if it set in config', () => {
            const prepareEnvironment = sinon.spy().named('prepareEnvironment');

            const config = readConfig_('hermione.js', {prepareEnvironment});

            assert.calledOnce(config.prepareEnvironment);
        });

        it('should not throw on relative path to config file', () => {
            assert.doesNotThrow(() => readConfig_('./test/hermione.js'));
        });

        it('should not throw on absolute path to config file', () => {
            const absolutePath = path.resolve(__dirname, '../../test/hermione.js');

            assert.doesNotThrow(() => readConfig_(absolutePath));
        });
    });

    describe('forBrowser', () => {
        it('should return browser config', () => {
            const capabilities = {browserName: 'bro'};

            parseOptions.returns({browsers: {bro: {capabilities}}});

            const browserConfig = configStub.create().forBrowser('bro');

            assert.deepEqual(browserConfig, {id: 'bro', capabilities});
        });

        it('should extend browser config by system opts', () => {
            const capabilities = {browserName: 'bro'};
            const system = {systemProp: true};

            parseOptions.returns({browsers: {bro: {capabilities}}, system});

            const browserConfig = configStub.create().forBrowser('bro');

            assert.equal(browserConfig.systemProp, true);
        });
    });

    describe('getBrowserIds', () => {
        it('should return browsers ids', () => {
            const browsers = {bro1: {}, bro2: {}};
            parseOptions.returns({browsers});

            const browserIds = configStub.create().getBrowserIds();

            assert.deepEqual(browserIds, ['bro1', 'bro2']);
        });
    });

    describe('overrides options', () => {
        const mkConfig_ = (opts) => {
            return _.defaults(opts || {}, {
                specs: ['path/to/test']
            });
        };

        beforeEach(() => sandbox.stub(Config, 'read'));

        afterEach(() => {
            delete process.env['hermione_base_url'];
            process.argv = [];
        });

        it('should not override anything by default', () => {
            const readConfig = mkConfig_({baseUrl: 'http://default.com'});
            Config.read.returns(readConfig);

            const config = Config.create();

            assert.propertyVal(config, 'baseUrl', 'http://default.com');
        });

        it('should not override value with env if allowOverrides.env is false', () => {
            const readConfig = mkConfig_({baseUrl: 'http://default.com'});
            Config.read.returns(readConfig);

            const config = Config.create('configPath', {}, {env: false});

            assert.propertyVal(config, 'baseUrl', 'http://default.com');
        });

        it('should override value with env if allowOverrides.env is true', () => {
            const readConfig = mkConfig_({baseUrl: 'http://default.com'});
            Config.read.returns(readConfig);

            process.env['hermione_base_url'] = 'http://env.com';

            const config = Config.create('configPath', {}, {env: true});

            assert.propertyVal(config, 'baseUrl', 'http://env.com');
        });

        it('should not override value with env if allowOverrides.cli is false', () => {
            const readConfig = mkConfig_({baseUrl: 'http://default.com'});
            Config.read.returns(readConfig);

            const config = Config.create('configPath', {}, {cli: false});

            assert.propertyVal(config, 'baseUrl', 'http://default.com');
        });

        it('should override value with cli if allowOverrides.cli is true', () => {
            const readConfig = mkConfig_({baseUrl: 'http://default.com'});
            Config.read.returns(readConfig);

            process.argv = ['--base-url', 'http://cli.com'];

            const config = Config.create('configPath', {}, {cli: true});

            assert.propertyVal(config, 'baseUrl', 'http://cli.com');
        });
    });
});
