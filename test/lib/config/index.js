'use strict';

const _ = require('lodash');
const proxyquire = require('proxyquire');

const ConfigReader = require('../../../lib/config/config-reader');
const Config = require('../../../lib/config');

describe('config', () => {
    const sandbox = sinon.sandbox.create();

    const mkConfig_ = (opts) => {
        return _.defaults(opts || {}, {
            specs: ['path/to/test']
        });
    };

    afterEach(() => sandbox.restore());

    describe('parse', () => {
        let configStub;
        let parseOptions;

        beforeEach(() => {
            parseOptions = sandbox.stub();

            configStub = proxyquire('../../../lib/config', {
                './options': parseOptions
            });
        });

        it('should read config file', () => {
            sandbox.stub(ConfigReader.prototype, 'read').returns({});

            configStub.create({}).parse();

            assert.calledOnce(ConfigReader.prototype.read);
        });
    });

    describe('overrides options', () => {
        beforeEach(() => sandbox.stub(ConfigReader.prototype, 'read'));

        afterEach(() => {
            delete process.env['hermione_base_url'];
            process.argv = [];
        });

        it('should not override anything by default', () => {
            const readConfig = mkConfig_({baseUrl: 'http://default.com'});
            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}).parse();

            assert.propertyVal(parsedConfig, 'baseUrl', 'http://default.com');
        });

        it('should not override value with env if allowOverrides.env is false', () => {
            const readConfig = mkConfig_({baseUrl: 'http://default.com'});
            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}, {env: false}).parse();

            assert.propertyVal(parsedConfig, 'baseUrl', 'http://default.com');
        });

        it('should override value with env if allowOverrides.env is true', () => {
            const readConfig = mkConfig_({baseUrl: 'http://default.com'});
            ConfigReader.prototype.read.returns(readConfig);

            process.env['hermione_base_url'] = 'http://env.com';

            const parsedConfig = Config.create({}, {env: true}).parse();

            assert.propertyVal(parsedConfig, 'baseUrl', 'http://env.com');
        });

        it('should not override value with env if allowOverrides.cli is false', () => {
            const readConfig = mkConfig_({baseUrl: 'http://default.com'});
            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}, {cli: false}).parse();

            assert.propertyVal(parsedConfig, 'baseUrl', 'http://default.com');
        });

        it('should override value with cli if allowOverrides.cli is true', () => {
            const readConfig = mkConfig_({baseUrl: 'http://default.com'});
            ConfigReader.prototype.read.returns(readConfig);

            process.argv = ['--base-url', 'http://cli.com'];

            const parsedConfig = Config.create({}, {cli: true}).parse();

            assert.propertyVal(parsedConfig, 'baseUrl', 'http://cli.com');
        });
    });
});
