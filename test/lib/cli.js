'use strict';

const Commander = require('commander');
const globExtra = require('glob-extra');
const lodash = require('lodash');
const q = require('q');

const cli = require('../../lib/cli');
const Config = require('../../lib/config');
const Hermione = require('../../lib/hermione');
const logger = require('../../lib/utils').logger;

const CONFIG = require('../fixtures/.hermione.conf.js');

describe('cli', () => {
    const sandbox = sinon.sandbox.create();

    let config;

    beforeEach(() => {
        sandbox.stub(logger);
        sandbox.stub(process, 'exit');

        config = sinon.createStubInstance(Config);
        sandbox.stub(Config, 'create').returns(config);
        config.parse.returns({reporters: []});

        Commander.removeAllListeners();
    });

    afterEach(() => sandbox.restore());

    it('should pass conf option to config from cli', () => {
        process.argv = ['node', 'test', '-c', 'config.js'];

        return cli.run()
            .then(() => assert.equal(Config.create.firstCall.args[0].conf, 'config.js'));
    });

    it('should pass reporter option to config from cli', () => {
        process.argv = ['node', 'test', '-r', 'foo'];

        return cli.run()
            .then(() => assert.include(Config.create.firstCall.args[0].reporters, 'foo'));
    });

    it('should collect all reporter options to an array', () => {
        process.argv = ['node', 'test', '-r', 'bar', '-r', 'baz'];
        Commander.reporter = null;

        return cli.run()
            .then(() => assert.sameMembers(Config.create.firstCall.args[0].reporters, ['bar', 'baz']));
    });

    it('should add grep option to mochaOpts field in config from cli', () => {
        process.argv = ['node', 'test', '--grep', 'someString'];

        return cli.run()
            .then(() => assert.deepPropertyVal(Config.create.firstCall.args[0], 'mochaOpts.grep', 'someString'));
    });

    it('should pass browser option to Hermione run', () => {
        sandbox.stub(Hermione.prototype);

        process.argv = ['node', 'test', '-b', 'yabro'];

        return cli.run()
            .then(() => {
                assert.sameMembers(Hermione.prototype.run.firstCall.args[1], ['yabro'])});
    });

    it('should collect all browser options to an array', () => {
        sandbox.stub(Hermione.prototype);

        process.argv = ['node', 'test', '-b', 'yabro', '-b', 'amigo'];

        return cli.run()
            .then(() => {
                assert.sameMembers(Hermione.prototype.run.firstCall.args[1], ['yabro', 'amigo'])});
    });

    it('should pass config from cli to hermione', () => {
        sandbox.stub(Hermione.prototype);

        process.argv = ['node', 'test', '-c', 'config.js', '-r', 'foo', '--grep', 'someString'];

        const cliConfig = {
            conf: 'config.js',
            reporters: ['foo'],
            mochaOpts: {
                grep: 'someString'
            }
        };

        config.parse.returns(cliConfig);

        return cli.run()
            .then(() => {
                assert.calledWithExactly(Hermione.prototype.__constructor, cliConfig)});
    });

    describe('exit codes', () => {
        beforeEach(() => {
            sandbox.stub(globExtra, 'expandPaths').returns(q([]));
        });

        describe('config validity', () => {
            it('should exit with code 0 if config is ok', () => {
                config.parse.returns(CONFIG);

                return cli.run().finally(() => assert.calledWith(process.exit, 0));
            });

            it('should exit with code 1 if config can not be read', () => {
                config.parse.throws(new Error('Unable to read config'));

                return cli.run().finally(() => assert.calledWith(process.exit, 1));
            });
        });
    });
});
