'use strict';

const _ = require('lodash');
const Config = require('../../../lib/config');
const defaults = require('../../../lib/config/defaults');

describe('config options', () => {
    const sandbox = sinon.sandbox.create();

    const mkConfig_ = (opts) => {
        return _.defaults(opts || {}, {
            specs: ['path/to/test']
        });
    };

    const createConfig = () => Config.create(defaults.config);

    beforeEach(() => sandbox.stub(Config, 'read'));

    afterEach(() => sandbox.restore());

    describe('system', () => {
        describe('debug', () => {
            it('should throw error if debug is not a boolean', () => {
                const readConfig = mkConfig_(_.set({}, 'system.debug', 'String'));

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, 'value must be a boolean');
            });

            it('should set default debug option if it does not set in config file', () => {
                Config.read.returns(mkConfig_());

                const config = createConfig();

                assert.equal(config.system.debug, defaults.debug);
            });

            it('should override debug option', () => {
                const readConfig = mkConfig_(_.set({}, 'system.debug', true));
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config.system.debug, true);
            });
        });

        describe('mochaOpts', () => {
            it('should throw error if mochaOpts is not a null or object', () => {
                const readConfig = mkConfig_(_.set({}, 'system.mochaOpts', ['Array']));

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"mochaOpts" should be null or object');
            });

            it('should set default mochaOpts option if it does not set in config file', () => {
                Config.read.returns(mkConfig_());

                const config = createConfig();

                assert.deepEqual(config.system.mochaOpts, defaults.mochaOpts);
            });

            it('should override mochaOpts option', () => {
                const readConfig = mkConfig_(_.set({}, 'system.mochaOpts.grep', /test/));
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.deepEqual(config.system.mochaOpts.grep, /test/);
            });
        });
    });

    describe('prepareEnvironment', () => {
        it('should throw error if prepareEnvironment is not a null or function', () => {
            const readConfig = mkConfig_({prepareEnvironment: 'String'});

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, '"prepareEnvironment" should be null or function');
        });

        it('should set default prepareEnvironment option if it does not set in config file', () => {
            Config.read.returns(mkConfig_());

            const config = createConfig();

            assert.equal(config.prepareEnvironment, defaults.prepareEnvironment);
        });

        it('should override prepareEnvironment option', () => {
            const newFunc = () => {};
            const readConfig = mkConfig_({prepareEnvironment: newFunc});

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.prepareEnvironment, newFunc);
        });
    });

    describe('specs', () => {
        it('should throw error if specs is empty', () => {
            Config.read.returns({});

            assert.throws(() => createConfig(), Error, '"specs" is required option and should not be empty');
        });

        it('should throw error if specs option is not an array', () => {
            const readConfig = mkConfig_({specs: 'String'});

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, '"specs" should be an array');
        });

        it('should override specs option', () => {
            const readConfig = mkConfig_({specs: ['bar', 'baz']});
            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.specs, ['bar', 'baz']);
        });
    });
});
