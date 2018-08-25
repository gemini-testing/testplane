'use strict';

const _ = require('lodash');
const Config = require('lib/config');
const defaults = require('lib/config/defaults');

const parser = require('lib/config/options');

describe('config options', () => {
    const sandbox = sinon.sandbox.create();

    const createConfig = () => Config.create(defaults.config);

    const parse_ = (opts) => parser(_.defaults(opts, {env: {}, argv: []}));

    beforeEach(() => sandbox.stub(Config, 'read'));

    afterEach(() => sandbox.restore());

    describe('system', () => {
        describe('debug', () => {
            it('should throw error if debug is not a boolean', () => {
                const readConfig = _.set({}, 'system.debug', 'String');

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"debug" must be a boolean');
            });

            it('should set default debug option if it does not set in config file', () => {
                const config = createConfig();

                assert.equal(config.system.debug, defaults.debug);
            });

            it('should override debug option', () => {
                const readConfig = _.set({}, 'system.debug', true);
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config.system.debug, true);
            });
        });

        describe('mochaOpts', () => {
            it('should throw error if mochaOpts is not a null or object', () => {
                const readConfig = _.set({}, 'system.mochaOpts', ['Array']);

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"mochaOpts" must be an object');
            });

            it('should set default mochaOpts option if it does not set in config file', () => {
                const config = createConfig();

                assert.deepEqual(config.system.mochaOpts, defaults.mochaOpts);
            });

            it('should override mochaOpts option', () => {
                const readConfig = _.set({}, 'system.mochaOpts.grep', /test/);
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.deepEqual(config.system.mochaOpts.grep, /test/);
            });

            it('should parse mochaOpts option from environment', () => {
                const result = parse_({
                    options: {system: {mochaOpts: {}}},
                    env: {'hermione_system_mocha_opts': '{"some": "opts"}'}
                });

                assert.deepEqual(result.system.mochaOpts, {some: 'opts'});
            });

            it('should parse mochaOpts options from cli', () => {
                const result = parse_({
                    options: {system: {mochaOpts: {}}},
                    argv: ['--system-mocha-opts', '{"some": "opts"}']
                });

                assert.deepEqual(result.system.mochaOpts, {some: 'opts'});
            });
        });

        describe('ctx', () => {
            it('should be empty by default', () => {
                const config = createConfig();

                assert.deepEqual(config.system.ctx, {});
            });

            it('should override ctx option', () => {
                const readConfig = _.set({}, 'system.ctx', {some: 'ctx'});
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.deepEqual(config.system.ctx, {some: 'ctx'});
            });
        });

        ['patternsOnReject', 'patternsOnSkipAfterEachHooks'].forEach((option) => {
            describe(`${option}`, () => {
                it('should be empty by default', () => {
                    const config = createConfig();

                    assert.deepEqual(config.system[option], []);
                });

                it(`should throw error if "${option}" is not an array`, () => {
                    const readConfig = _.set({}, `system.${option}`, {});

                    Config.read.returns(readConfig);

                    assert.throws(() => createConfig(), Error, `"${option}" must be an array`);
                });

                it(`should override "${option}" option`, () => {
                    const readConfig = _.set({}, `system.${option}`, ['some-pattern']);
                    Config.read.returns(readConfig);

                    const config = createConfig();

                    assert.deepEqual(config.system[option], ['some-pattern']);
                });

                it(`should parse "${option}" option from environment`, () => {
                    const result = parse_({
                        options: {system: {[option]: []}},
                        env: {[`hermione_system_${_.snakeCase(option)}`]: '["some-pattern"]'}
                    });

                    assert.deepEqual(result.system[option], ['some-pattern']);
                });

                it(`should parse "${option}" options from cli`, () => {
                    const result = parse_({
                        options: {system: {[option]: []}},
                        argv: [`--system-${_.kebabCase(option)}`, '["some-pattern"]']
                    });

                    assert.deepEqual(result.system[option], ['some-pattern']);
                });
            });
        });

        describe('workers', () => {
            it('should throw in case of not positive integer', () => {
                [0, -1, 'string', {foo: 'bar'}].forEach((workers) => {
                    Config.read.returns({system: {workers}});

                    assert.throws(() => createConfig(), '"workers" must be a positive integer');
                });
            });

            it('should equal one by default', () => {
                const config = createConfig();

                assert.equal(config.system.workers, 1);
            });

            it('should be overriden from a config', () => {
                Config.read.returns({system: {workers: 100500}});

                const config = createConfig();

                assert.equal(config.system.workers, 100500);
            });
        });

        describe('diffColor', () => {
            it('should be #ff00ff by default', () => {
                const config = createConfig();

                assert.deepEqual(config.system.diffColor, '#ff00ff');
            });

            it('should override diffColor option', () => {
                const readConfig = _.set({}, 'system.diffColor', '#f5f5f5');
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config.system.diffColor, '#f5f5f5');
            });

            it('should throw an error if option is not a string', () => {
                const readConfig = _.set({}, 'system.diffColor', 1);

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"diffColor" must be a string');
            });

            it('should throw an error if option is not a hexadecimal value', () => {
                const readConfig = _.set({}, 'system.diffColor', '#gggggg');

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, /"diffColor" must be a hexadecimal/);
            });
        });

        describe('tempDir', () => {
            it('should set default option if it does not set in config file', () => {
                const config = createConfig();

                assert.deepEqual(config.system.tempDir, defaults.tempDir);
            });

            it('should override tempDir option', () => {
                const readConfig = _.set({}, 'system.tempDir', '/def/path');
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config.system.tempDir, '/def/path');
            });

            it('should throw an error if option is not a string', () => {
                const readConfig = _.set({}, 'system.tempDir', 1);

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"tempDir" must be a string');
            });
        });
    });

    describe('prepareEnvironment', () => {
        it('should throw error if prepareEnvironment is not a null or function', () => {
            const readConfig = {prepareEnvironment: 'String'};

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, '"prepareEnvironment" must be a function');
        });

        it('should set default prepareEnvironment option if it does not set in config file', () => {
            const config = createConfig();

            assert.equal(config.prepareEnvironment, defaults.prepareEnvironment);
        });

        it('should override prepareEnvironment option', () => {
            const newFunc = () => {};
            const readConfig = {prepareEnvironment: newFunc};

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.prepareEnvironment, newFunc);
        });
    });

    describe('plugins', () => {
        it('should parse boolean value from environment', () => {
            const result = parse_({
                options: {plugins: {foo: {}}},
                env: {'hermione_plugins_foo': 'true'}
            });

            assert.strictEqual(result.plugins.foo, true);
        });

        it('should parse object value from environment', () => {
            const result = parse_({
                options: {plugins: {foo: {}}},
                env: {'hermione_plugins_foo': '{"opt": 1}'}
            });

            assert.deepEqual(result.plugins.foo, {opt: 1});
        });

        it('should throw error on invalid values from environment', () => {
            assert.throws(
                () => parse_({
                    options: {plugins: {foo: {}}},
                    env: {'hermione_plugins_foo': '{key: 1}'}
                }),
                'a value must be a primitive type'
            );
        });

        it('should parse boolean value from cli', () => {
            const result = parse_({
                options: {plugins: {foo: {}}},
                argv: ['--plugins-foo', 'true']
            });

            assert.strictEqual(result.plugins.foo, true);
        });

        it('should parse object value from cli', () => {
            const result = parse_({
                options: {plugins: {foo: {}}},
                argv: ['--plugins-foo', '{"opt": 1}']
            });

            assert.deepEqual(result.plugins.foo, {opt: 1});
        });

        it('should throw error on invalid values from cli', () => {
            assert.throws(
                () => parse_({
                    options: {plugins: {foo: {}}},
                    argv: ['--plugins-foo', '{key: 1}']
                }),
                'a value must be a primitive type'
            );
        });
    });

    describe('shouldRetry', () => {
        it('should throw error if shouldRetry is not a function', () => {
            const readConfig = _.set({}, 'shouldRetry', 'shouldRetry');

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, '"shouldRetry" must be a function');
        });

        it('should set default shouldRetry option if it does not set in config file', () => {
            const config = createConfig();

            assert.equal(config.shouldRetry, null);
        });

        it('should override shouldRetry option', () => {
            const shouldRetry = () => {};
            const readConfig = _.set({}, 'shouldRetry', shouldRetry);
            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.shouldRetry, shouldRetry);
        });
    });
});
