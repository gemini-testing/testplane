'use strict';

const {Command} = require('@gemini-testing/commander');
const q = require('q');
const _ = require('lodash');
const proxyquire = require('proxyquire').noCallThru();
const hermioneCli = require('lib/cli');
const info = require('lib/cli/info');
const defaults = require('lib/config/defaults');
const Hermione = require('lib/hermione');
const logger = require('lib/utils/logger');

const any = sinon.match.any;

describe('cli', () => {
    const sandbox = sinon.sandbox.create();
    let actionPromise;

    const onParse = (fn = _.noop) => {
        let parser;

        Command.prototype.parse.callsFake(function() {
            parser = fn(this) || {};

            if (Command.prototype.action.lastCall) {
                const actionFn = Command.prototype.action.lastCall.args[0];
                actionPromise = actionFn(parser.args);
            }
        });
    };

    beforeEach(() => {
        sandbox.stub(Hermione, 'create').returns(Object.create(Hermione.prototype));
        sandbox.stub(Hermione.prototype, 'run').resolves();
        sandbox.stub(Hermione.prototype, 'extendCli');

        sandbox.stub(logger, 'log');
        sandbox.stub(logger, 'error');

        sandbox.stub(process, 'exit');

        sandbox.stub(Command.prototype, 'parse');
        sandbox.stub(Command.prototype, 'action');

        onParse();
    });

    afterEach(() => sandbox.restore());

    it('should show information about config overriding on "--help"', async () => {
        onParse((parser) => parser.emit('--help'));

        hermioneCli.run();
        await actionPromise;

        assert.calledOnce(logger.log);
        assert.calledWith(logger.log, info.configOverriding);
    });

    it('should create Hermione instance', async () => {
        hermioneCli.run();
        await actionPromise;

        assert.calledOnce(Hermione.create);
    });

    it('should require modules specified in "require" option', async () => {
        const fooRequire = sandbox.stub().returns({});

        const stubHermioneCli = proxyquire('lib/cli', {
            foo: (() => fooRequire())()
        });

        onParse((parser) => parser.require = ['foo']);

        stubHermioneCli.run();
        await actionPromise;

        assert.calledOnce(fooRequire);
    });

    it('should create Hermione without config by default', async () => {
        hermioneCli.run();
        await actionPromise;

        assert.calledWith(Hermione.create, undefined);
    });

    it('should use config path from cli', async () => {
        onParse((parser) => _.set(parser, 'config', '.conf.hermione.js'));

        hermioneCli.run();
        await actionPromise;

        assert.calledWith(Hermione.create, '.conf.hermione.js');
    });

    it('should run hermione', async () => {
        hermioneCli.run();
        await actionPromise;

        assert.calledOnce(Hermione.prototype.run);
    });

    it('should run hermione with paths from args', async () => {
        onParse((parser) => _.set(parser, 'args', ['first.hermione.js', 'second.hermione.js']));

        hermioneCli.run();
        await actionPromise;

        assert.calledWith(Hermione.prototype.run, ['first.hermione.js', 'second.hermione.js']);
    });

    it('should use default reporters when running hermione', async () => {
        hermioneCli.run();
        await actionPromise;

        assert.calledWithMatch(Hermione.prototype.run, any, {reporters: defaults.reporters});
    });

    it('should use reporters from cli', async () => {
        onParse((parser) => parser.reporter = ['first', 'second']);

        hermioneCli.run();
        await actionPromise;

        assert.calledWithMatch(Hermione.prototype.run, any, {reporters: ['first', 'second']});
    });

    it('should not pass any browsers if they were not specified from cli', async () => {
        hermioneCli.run();
        await actionPromise;

        assert.calledWithMatch(Hermione.prototype.run, any, {browsers: undefined});
    });

    it('should use browsers from cli', async () => {
        onParse((parser) => parser.browser = ['first', 'second']);

        hermioneCli.run();
        await actionPromise;

        assert.calledWithMatch(Hermione.prototype.run, any, {browsers: ['first', 'second']});
    });

    it('should not pass any grep rule if it was not specified from cli', async () => {
        hermioneCli.run();
        await actionPromise;

        assert.calledWithMatch(Hermione.prototype.run, any, {grep: undefined});
    });

    it('should use grep rule from cli', async () => {
        onParse((parser) => parser.grep = 'some-rule');

        hermioneCli.run();
        await actionPromise;

        assert.calledWithMatch(Hermione.prototype.run, any, {grep: 'some-rule'});
    });

    it('should use update refs mode from cli', async () => {
        onParse((parser) => parser.updateRefs = true);

        hermioneCli.run();
        await actionPromise;

        assert.calledWithMatch(Hermione.prototype.run, any, {updateRefs: true});
    });

    it('should use require modules from cli', async () => {
        const stubHermioneCli = proxyquire('lib/cli', {foo: {}});
        onParse((parser) => parser.require = ['foo']);

        stubHermioneCli.run();
        await actionPromise;

        assert.calledWithMatch(Hermione.prototype.run, any, {requireModules: ['foo']});
    });

    it('should allow hermione to extend cli', async () => {
        hermioneCli.run();
        await actionPromise;

        assert.calledOnceWith(Hermione.prototype.extendCli, sinon.match.instanceOf(Command));
    });

    it('should extend cli before parse', async () => {
        hermioneCli.run();
        await actionPromise;

        assert.callOrder(Hermione.prototype.extendCli, Command.prototype.parse);
    });

    it('should exit with code 0 if tests pass', async () => {
        Hermione.prototype.run.resolves(true);
        hermioneCli.run();
        await actionPromise;

        assert.calledWith(process.exit, 0);
    });

    it('should exit with code 1 if tests fail', async () => {
        Hermione.prototype.run.resolves(false);
        hermioneCli.run();
        await actionPromise;

        assert.calledWith(process.exit, 1);
    });

    it('should exit with code 1 on reject', async () => {
        Hermione.prototype.run.rejects();
        hermioneCli.run();
        await actionPromise;

        assert.calledWith(process.exit, 1);
    });

    it('should log an error stack on reject', async () => {
        Hermione.prototype.run.rejects({stack: 'some-stack'});
        hermioneCli.run();
        await actionPromise;

        assert.calledWith(logger.error, 'some-stack');
    });

    it('should log an error on reject if stack does not exist', async () => {
        Hermione.prototype.run.returns(q.reject('some-error'));
        hermioneCli.run();
        await actionPromise;

        assert.calledWith(logger.error, 'some-error');
    });

    it('should turn on debug mode from cli', async () => {
        onParse((parser) => parser.inspect = true);

        hermioneCli.run();
        await actionPromise;

        assert.calledWithMatch(Hermione.prototype.run, any, {inspectMode: {inspect: true}});
    });

    it('should turn on debug mode from cli with params', async () => {
        onParse((parser) => parser.inspectBrk = '9229');

        hermioneCli.run();
        await actionPromise;

        assert.calledWithMatch(Hermione.prototype.run, any, {inspectMode: {inspectBrk: '9229'}});
    });
});
