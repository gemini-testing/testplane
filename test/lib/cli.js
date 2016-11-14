'use strict';

const Commander = require('commander');
const globExtra = require('glob-extra');
const proxyquire = require('proxyquire');
const q = require('q');

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

    it('should pass config path to config initialization from cli', () => {
        process.argv = ['node', 'hermione', '-c', 'config.js'];

        return cliStub.run()
            .then(() => assert.calledWithMatch(Config.create, 'config.js'));
    });

    it('should collect all reporter options to an array', () => {
        sandbox.stub(Hermione, 'create');

        process.argv = ['node', 'hermione', '-r', 'bar', '-r', 'baz'];

        return cliStub.run()
            .then(() => assert.calledWithMatch(Hermione.create, sinon.match.any, {reporters: ['bar', 'baz']}));
    });

    it('should pass grep option to config initialization from cli', () => {
        process.argv = ['node', 'hermione', '--grep', 'someString'];

        const cliConfig = {system: {mochaOpts: {grep: 'someString'}}};

        return cliStub.run()
            .then(() => assert.calledWithMatch(Config.create, sinon.match.any, cliConfig));
    });

    it('should collect all browser options to an array', () => {
        process.argv = ['node', 'hermione', '-b', 'yabro', '-b', 'amigo'];

        return cliStub.run()
            .then(() => assert.calledWithMatch(Hermione.prototype.run, sinon.match.any, ['yabro', 'amigo']));
    });

    it('should pass config to Hermione', () => {
        sandbox.stub(Hermione, 'create');

        Config.create.returns(defaults);

        return cliStub.run()
            .then(() => assert.calledWithMatch(Hermione.create, defaults));
    });

    it('should run Hermione with test suite path', () => {
        process.argv = ['node', 'hermione', 'path/to/test-suite'];

        return cliStub.run()
            .then(() => assert.calledWithMatch(Hermione.prototype.run, ['path/to/test-suite']));
    });

    describe('exit codes', () => {
        beforeEach(() => sandbox.stub(globExtra, 'expandPaths').returns(q([])));

        it('should exit with code 0 if config is ok', () => {
            Config.create.returns(CONFIG);

            return cliStub.run()
                .finally(() => assert.calledWith(process.exit, 0));
        });

        it('should exit with code 1 if config can not be read', () => {
            Config.create.throws(new Error('Unable to read config'));

            return cliStub.run()
                .finally(() => assert.calledWith(process.exit, 1));
        });
    });
});
