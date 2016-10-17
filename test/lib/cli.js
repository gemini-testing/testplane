'use strict';

const Commander = require('commander');
const globExtra = require('glob-extra');
const proxyquire = require('proxyquire');
const q = require('q');

const cli = require('../../lib/cli');
const Config = require('../../lib/config');
const defaults = require('../../lib/config/defaults');
const Hermione = require('../../lib/hermione');
const logger = require('../../lib/utils').logger;

const CONFIG = require('../fixtures/.hermione.conf.js');

describe('cli', () => {
    const sandbox = sinon.sandbox.create();

    let config;
    let cliStub;

    beforeEach(() => {
        sandbox.stub(logger);
        sandbox.stub(process, 'exit');

        sandbox.stub(Hermione.prototype, 'run').returns(q(true));

        config = sinon.createStubInstance(Config);
        sandbox.stub(Config, 'create').returns(config);
        config.parse.returns({reporters: []});

        cliStub = proxyquire('../../lib/cli', {
            './validators': {
                validateEmptyBrowsers: sandbox.stub()
            }
        });

        Commander.removeAllListeners();
    });

    afterEach(() => {
        Commander.reporter = null;
        Commander.browser = null;

        process.argv = [];

        sandbox.restore();
    });

    it('should pass config option to config from cli', () => {
        process.argv = ['node', 'hermione', '-c', 'config.js'];

        return cliStub.run()
            .then(() => assert.calledWithMatch(Config.create, {config: 'config.js'}));
    });

    it('should collect all reporter options to an array', () => {
        process.argv = ['node', 'hermione', '-r', 'bar', '-r', 'baz'];

        return cliStub.run()
            .then(() => assert.calledWithMatch(Config.create, {reporters: ['bar', 'baz']}));
    });

    it('should add grep option to mochaOpts field in config from cli', () => {
        process.argv = ['node', 'hermione', '--grep', 'someString'];

        return cliStub.run()
            .then(() => assert.calledWithMatch(Config.create, {mochaOpts: {grep: 'someString'}}));
    });

    it('should collect all browser options to an array', () => {
        process.argv = ['node', 'hermione', '-b', 'yabro', '-b', 'amigo'];

        return cliStub.run()
            .then(() => assert.calledWithMatch(Hermione.prototype.run, sinon.match.any, ['yabro', 'amigo']));
    });

    it('should pass parsed config to Hermione', () => {
        sandbox.stub(Hermione, 'create');

        const parsedConfig = defaults;

        config.parse.returns(parsedConfig);

        return cliStub.run()
            .then(() => assert.calledWithMatch(Hermione.create, parsedConfig));
    });

    it('should run Hermione with test suite path', () => {
        process.argv = ['node', 'hermione', 'path/to/test-suite'];

        return cliStub.run()
            .then(() => assert.calledWithMatch(Hermione.prototype.run, ['path/to/test-suite']));
    });

    describe('validate browsers', () => {
        it('should throw error if "browsers" is empty', () => {
            config.parse.returns({});

            return cli.run().finally(() => {
                assert.calledWithMatch(logger.error, '"browsers" is required option and should not be empty');
                assert.calledWith(process.exit, 1);
            });
        });

        it('should throw an error if "browsers" option is not an object', () => {
            config.parse.returns({browsers: 'String'});

            return cli.run().finally(() => {
                assert.calledWithMatch(logger.error, '"browsers" should be an object');
                assert.calledWith(process.exit, 1);
            });
        });
    });

    describe('exit codes', () => {
        beforeEach(() => sandbox.stub(globExtra, 'expandPaths').returns(q([])));

        it('should exit with code 0 if config is ok', () => {
            config.parse.returns(CONFIG);

            return cliStub.run()
                .finally(() => assert.calledWith(process.exit, 0));
        });

        it('should exit with code 1 if config can not be read', () => {
            config.parse.throws(new Error('Unable to read config'));

            return cliStub.run()
                .finally(() => assert.calledWith(process.exit, 1));
        });
    });
});
