'use strict';

const path = require('path');
const _ = require('lodash');
const proxyquire = require('proxyquire').noCallThru();
const defaults = require('../../../lib/config/defaults');

describe('config', () => {
    const sandbox = sinon.sandbox.create();

    let parseOptions;

    const initConfig = (opts) => {
        opts = opts || {};
        parseOptions = sandbox.stub().returns(opts.configParserReturns);

        const configPath = opts.configPath || defaults.config;
        const resolvedConfigPath = path.resolve(process.cwd(), configPath);
        const Config = proxyquire('../../../lib/config', {
            './options': parseOptions,
            [resolvedConfigPath]: opts.requireConfigReturns || {}
        });

        return Config.create(opts.config || configPath, opts.allowOverrides);
    };

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should parse options', () => {
            initConfig();

            assert.calledOnce(parseOptions);
        });

        it('should parse config from file', () => {
            initConfig({requireConfigReturns: 'some-options'});

            assert.calledWithMatch(parseOptions, {options: 'some-options'});
        });

        it('should parse config from object', () => {
            initConfig({config: {some: 'config'}});

            assert.calledWithMatch(parseOptions, {options: {some: 'config'}});
        });

        it('should not allow to override options from cli options and env variables by default', () => {
            initConfig();

            assert.calledWithMatch(parseOptions, {env: {}, argv: []});
        });

        it('should allow to override options from env variables', () => {
            initConfig({allowOverrides: {env: true}});

            process.env['hermione_base_url'] = 'http://env.com';

            const args = parseOptions.lastCall.args[0];
            assert.propertyVal(args.env, 'hermione_base_url', 'http://env.com');

            delete process.env['hermione_base_url'];
        });

        it('should allow to override options from cli options', () => {
            initConfig({allowOverrides: {cli: true}});

            process.argv.push('--base-url');

            const args = parseOptions.lastCall.args[0];

            assert.equal(_.last(args.argv), '--base-url');

            process.argv.pop();
        });

        it('should create config', () => {
            assert.deepEqual(initConfig({configParserReturns: {some: 'option'}}), {some: 'option'});
        });
    });

    describe('forBrowser', () => {
        it('should get config for a browser', () => {
            const config = initConfig({configParserReturns: {browsers: {bro: {some: 'option'}}}});

            assert.deepEqual(config.forBrowser('bro'), {some: 'option'});
        });
    });

    describe('getBrowserIds', () => {
        it('should get browser ids', () => {
            const config = initConfig({configParserReturns: {browsers: {bro1: {}, bro2: {}}}});

            assert.deepEqual(config.getBrowserIds(), ['bro1', 'bro2']);
        });
    });
});
