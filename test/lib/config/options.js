'use strict';

const path = require('path');
const _ = require('lodash');

const ConfigReader = require('../../../lib/config/config-reader');
const defaults = require('../../../lib/config/defaults');
const Config = require('../../../lib/config');

describe('config options', () => {
    const sandbox = sinon.sandbox.create();

    const mkConfig_ = (opts) => {
        return _.defaults(opts || {}, {
            specs: ['path/to/test']
        });
    };

    beforeEach(() => sandbox.stub(ConfigReader.prototype, 'read'));

    afterEach(() => sandbox.restore());

    describe('config', () => {
        it('should throw error if config is not a string', () => {
            const readConfig = mkConfig_({config: ['Array']});
            ConfigReader.prototype.read.returns(readConfig);

            const config = Config.create({});

            assert.throws(() => config.parse(), Error, 'value must be a string');
        });

        it('should set default config relative to project dir if it does not set in config file', () => {
            ConfigReader.prototype.read.returns(mkConfig_());

            const parsedConfig = Config.create({}).parse();
            const resolvedPath = path.resolve(process.cwd(), defaults.config);

            assert.equal(parsedConfig.config, resolvedPath);
        });

        it('should override config relative to project dir', () => {
            const readConfig = mkConfig_({config: './config.js'});
            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}).parse();
            const resolvedPath = path.resolve(process.cwd(), './config.js');

            assert.equal(parsedConfig.config, resolvedPath);
        });
    });

    describe('debug', () => {
        it('should throw error if debug is not a boolean', () => {
            const readConfig = mkConfig_({debug: 'String'});
            ConfigReader.prototype.read.returns(readConfig);

            const config = Config.create({});

            assert.throws(() => config.parse(), Error, 'value must be a boolean');
        });

        it('should set default debug option if it does not set in config file', () => {
            ConfigReader.prototype.read.returns(mkConfig_());

            const parsedConfig = Config.create({}).parse();

            assert.equal(parsedConfig.debug, defaults.debug);
        });

        it('should override debug option', () => {
            const readConfig = mkConfig_({debug: true});
            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}).parse();

            assert.equal(parsedConfig.debug, true);
        });
    });

    describe('mochaOpts', () => {
        it('should throw error if mochaOpts is not an error or object', () => {
            const readConfig = mkConfig_({mochaOpts: ['Array']});
            ConfigReader.prototype.read.returns(readConfig);

            const config = Config.create({});

            assert.throws(() => config.parse(), Error, '"mochaOpts" should be null or object');
        });

        it('should set default mochaOpts option if it does not set in config file', () => {
            ConfigReader.prototype.read.returns(mkConfig_());

            const parsedConfig = Config.create({}).parse();

            assert.deepEqual(parsedConfig.mochaOpts, defaults.mochaOpts);
        });

        it('should override mochaOpts option', () => {
            const mochaOpts = {
                slow: 1000,
                timeout: 10000,
                grep: 'test',
                ignoreLeaks: true
            };

            const readConfig = mkConfig_({mochaOpts});
            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}).parse();

            assert.deepEqual(parsedConfig.mochaOpts, mochaOpts);
        });
    });

    ['prepareBrowser', 'prepareEnvironment'].forEach((option) => {
        describe(`${option}`, () => {
            it(`should throw error if ${option} is not a null or function`, () => {
                const readConfig = mkConfig_(_.set({}, option, {}));
                ConfigReader.prototype.read.returns(readConfig);

                const config = Config.create({});

                assert.throws(() => config.parse(), Error, `"${option}" should be null or function`);
            });

            it(`should set default ${option} option if it does not set in config file`, () => {
                ConfigReader.prototype.read.returns(mkConfig_());

                const parsedConfig = Config.create({}).parse();

                assert.equal(parsedConfig[option], defaults[option]);
            });

            it(`should override ${option} option`, () => {
                const func = () => {};
                const readConfig = mkConfig_(_.set({}, option, func));

                ConfigReader.prototype.read.returns(readConfig);

                const parsedConfig = Config.create({}).parse();

                assert.deepEqual(parsedConfig[option], func);
            });
        });
    });

    describe('reporters', () => {
        it('should throw error if reporters is not an array', () => {
            const readConfig = mkConfig_({reporters: 'String'});
            ConfigReader.prototype.read.returns(readConfig);

            const config = Config.create({});

            assert.throws(() => config.parse(), Error, '"reporters" should be an array');
        });

        it('should set default reporters option if it does not set in config file', () => {
            ConfigReader.prototype.read.returns(mkConfig_());

            const parsedConfig = Config.create({}).parse();

            assert.sameMembers(parsedConfig.reporters, defaults.reporters);
        });

        it('should override reporters option', () => {
            const readConfig = mkConfig_({reporters: ['foo', 'bar']});
            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}).parse();

            assert.deepEqual(parsedConfig.reporters, ['foo', 'bar']);
        });
    });

    describe('specs', () => {
        it('should throw error if specs is empty', () => {
            ConfigReader.prototype.read.returns({});

            const config = Config.create({});

            assert.throws(() => config.parse(), Error, '"specs" is required option and should not be empty');
        });

        it('should throw error if specs option is not an array', () => {
            const readConfig = mkConfig_({specs: 'String'});
            ConfigReader.prototype.read.returns(readConfig);

            const config = Config.create({});

            assert.throws(() => config.parse(), Error, '"specs" should be an array');
        });

        it('should override specs option', () => {
            const readConfig = mkConfig_({specs: ['bar', 'baz']});
            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}).parse();

            assert.deepEqual(parsedConfig.specs, ['bar', 'baz']);
        });
    });
});
