'use strict';

const program = require('commander');
const _ = require('lodash');
const q = require('q');
const hermioneCli = require('../../../lib/cli');
const info = require('../../../lib/cli/info');
const defaults = require('../../../lib/config/defaults');
const Hermione = require('../../../lib/hermione');
const logger = require('../../../lib/utils').logger;

const any = sinon.match.any;

describe('cli', () => {
    const sandbox = sinon.sandbox.create();

    let originalArgs;

    const addToProcessArgv = (argv) => {
        originalArgs = _.clone(process.argv);
        process.argv = process.argv.concat(argv);
    };

    beforeEach(() => {
        sandbox.stub(Hermione, 'create').returns(Object.create(Hermione.prototype));
        sandbox.stub(Hermione.prototype, 'run').returns(q(true));

        sandbox.stub(logger, 'log');
        sandbox.stub(logger, 'error');

        sandbox.stub(process, 'exit');
    });

    afterEach(() => {
        sandbox.restore();
        program.removeAllListeners();

        process.argv = originalArgs || process.argv;
    });

    it('should show information about config overriding on "--help"', () => {
        return hermioneCli.run()
            .then(() => program.emit('--help'))
            .then(() => {
                assert.calledOnce(logger.log);
                assert.calledWith(logger.log, info.configOverriding);
            });
    });

    it('should create Hermione instance', () => {
        return hermioneCli.run()
            .then(() => assert.calledOnce(Hermione.create));
    });

    it('should use default config path', () => {
        return hermioneCli.run()
            .then(() => assert.calledWith(Hermione.create, defaults.config));
    });

    it('should use config path from cli option "--config"', () => {
        addToProcessArgv(['--config', '.conf.hermione.js']);

        return hermioneCli.run()
            .then(() => assert.calledWith(Hermione.create, '.conf.hermione.js'));
    });

    it('should use config path from cli option "-c"', () => {
        addToProcessArgv(['-c', '.conf.hermione.js']);

        return hermioneCli.run()
            .then(() => assert.calledWith(Hermione.create, '.conf.hermione.js'));
    });

    it('should run hermione', () => {
        return hermioneCli.run()
            .then(() => assert.calledOnce(Hermione.prototype.run));
    });

    it('should run hermione with paths from args', () => {
        addToProcessArgv(['first.hermione.js', 'second.hermione.js']);

        return hermioneCli.run()
            .then(() => assert.calledWith(Hermione.prototype.run, ['first.hermione.js', 'second.hermione.js']));
    });

    it('should use default reporters when running hermione', () => {
        return hermioneCli.run()
            .then(() => assert.calledWithMatch(Hermione.prototype.run, any, {reporters: defaults.reporters}));
    });

    it('should use reporters from cli options "--reporter" and "-r"', () => {
        addToProcessArgv(['--reporter', 'first', '-r', 'second']);

        return hermioneCli.run()
            .then(() => assert.calledWithMatch(Hermione.prototype.run, any, {reporters: ['first', 'second']}));
    });

    it('should not pass any browsers if they were not specified from cli', () => {
        return hermioneCli.run()
            .then(() => assert.calledWithMatch(Hermione.prototype.run, any, {browsers: undefined}));
    });

    it('should use browsers from cli options "--browser" and "-b"', () => {
        addToProcessArgv(['--browser', 'first', '-b', 'second']);

        return hermioneCli.run()
            .then(() => assert.calledWithMatch(Hermione.prototype.run, any, {browsers: ['first', 'second']}));
    });

    it('should not pass any grep rule if it was not specified from cli', () => {
        return hermioneCli.run()
            .then(() => assert.calledWithMatch(Hermione.prototype.run, any, {grep: undefined}));
    });

    it('should use grep rule from cli option "--grep"', () => {
        addToProcessArgv(['--grep', 'some-rule']);

        return hermioneCli.run()
            .then(() => assert.calledWithMatch(Hermione.prototype.run, any, {grep: 'some-rule'}));
    });

    it('should exit with code 0 if tests pass', () => {
        Hermione.prototype.run.returns(q(true));

        return hermioneCli.run()
            .then(() => assert.calledWith(process.exit, 0));
    });

    it('should exit with code 1 if tests fail', () => {
        Hermione.prototype.run.returns(q(false));

        return hermioneCli.run()
            .then(() => assert.calledWith(process.exit, 1));
    });

    it('should exit with code 1 on reject', () => {
        Hermione.prototype.run.returns(q.reject({}));

        return hermioneCli.run()
            .then(() => assert.calledWith(process.exit, 1));
    });

    it('should log an error stack on reject', () => {
        Hermione.prototype.run.returns(q.reject({stack: 'some-stack'}));

        return hermioneCli.run()
            .then(() => assert.calledWith(logger.error, 'some-stack'));
    });

    it('should log an error on reject if stack does not exist', () => {
        Hermione.prototype.run.returns(q.reject('some-error'));

        return hermioneCli.run()
            .then(() => assert.calledWith(logger.error, 'some-error'));
    });
});
