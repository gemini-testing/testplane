'use strict';

const Commander = require('commander');
const globExtra = require('glob-extra');
const _ = require('lodash');
const proxyquire = require('proxyquire');
const q = require('q');

const cli = require('../../lib/cli');
const Config = require('../../lib/config');
const defaults = require('../../lib/config/defaults');
const Hermione = require('../../lib/hermione');
const logger = require('../../lib/utils').logger;
const validateBrowsers = require('../../lib/config/validators').validateBrowsers;

const CONFIG = require('../fixtures/.hermione.conf.js');

const mkConfig = (opts) => {
    return _.defaults(opts || {}, {
        browsers: {
            b1: {},
            b2: {}
        }
    });
}

describe('cli', () => {
    const sandbox = sinon.sandbox.create();

    let config;
    let cliStub;

    beforeEach(() => {
        sandbox.stub(logger);
        sandbox.stub(process, 'exit');

        config = sinon.createStubInstance(Config);
        sandbox.stub(Config, 'create').returns(config);
        config.parse.returns({reporters: []});

        cliStub = proxyquire('../../lib/cli', {
            './config/validators': {
                validateBrowsers: sinon.stub()
            }
        });

        Commander.removeAllListeners();
    });

    afterEach(() => {
        Commander.reporter = null;
        Commander.browser = null;
        sandbox.restore();
    });

    it('should pass conf option to config from cli', () => {
        process.argv = ['node', 'test', '-c', 'config.js'];

        return cliStub.run()
            .then(() => assert.equal(Config.create.firstCall.args[0].conf, 'config.js'));
    });

    it('should pass reporter option to config from cli', () => {
        process.argv = ['node', 'test', '-r', 'foo'];

        return cliStub.run()
            .then(() => assert.include(Config.create.firstCall.args[0].reporters, 'foo'));
    });

    it('should collect all reporter options to an array', () => {
        process.argv = ['node', 'test', '-r', 'bar', '-r', 'baz'];

        return cliStub.run()
            .then(() => assert.deepEqual(Config.create.firstCall.args[0].reporters, ['bar', 'baz']));
    });

    it('should add grep option to mochaOpts field in config from cli', () => {
        process.argv = ['node', 'test', '--grep', 'someString'];

        return cliStub.run()
            .then(() => assert.deepPropertyVal(Config.create.firstCall.args[0], 'mochaOpts.grep', 'someString'));
    });

    it('should pass browser option to Hermione run as second param', () => {
        sandbox.stub(Hermione.prototype);

        process.argv = ['node', 'test', '-b', 'yabro'];

        return cliStub.run()
            .then(() => {
                assert.deepEqual(Hermione.prototype.run.firstCall.args[1], ['yabro'])});
    });

    it('should collect all browser options to an array', () => {
        sandbox.stub(Hermione.prototype);

        process.argv = ['node', 'test', '-b', 'yabro', '-b', 'amigo'];

        return cliStub.run()
            .then(() => {
                assert.deepEqual(Hermione.prototype.run.firstCall.args[1], ['yabro', 'amigo'])});
    });

    it('should pass parsed config to Hermione', () => {
        sandbox.stub(Hermione.prototype);

        const parsedConfig = defaults;

        config.parse.returns(parsedConfig);

        return cliStub.run()
            .then(() => {
                assert.calledWithExactly(Hermione.prototype.__constructor, parsedConfig)});
    });

    it('should pass test suite path to Hermione run as first param', () => {
        sandbox.stub(Hermione.prototype);

        process.argv = ['node', 'test', 'path/to/test-suite'];

        return cliStub.run()
            .then(() => {
                assert.deepEqual(Hermione.prototype.run.firstCall.args[0], ['path/to/test-suite'])});
    });

    describe('validate browsers', () => {
        it('should throw error if "browsers" is empty', () => {
            config.parse.returns({});

            return cli.run().finally(() => {
                assert.calledOnce(logger.error);
                assert.calledWith(process.exit, 1);
            });
        });

        it('should throw error if "browsers" option is not an object', () => {
            config.parse.returns({browsers: 'String'});

            return cli.run().finally(() => {
                assert.calledOnce(logger.error);
                assert.calledWith(process.exit, 1);
            });
        });
    });

    describe('exit codes', () => {
        beforeEach(() => sandbox.stub(globExtra, 'expandPaths').returns(q([])));

        describe('config validity', () => {
            it('should exit with code 0 if config is ok', () => {
                config.parse.returns(CONFIG);

                return cliStub.run().finally(() => assert.calledWith(process.exit, 0));
            });

            it('should exit with code 1 if config can not be read', () => {
                config.parse.throws(new Error('Unable to read config'));

                return cliStub.run().finally(() => assert.calledWith(process.exit, 1));
            });
        });
    });
});
