'use strict';

const path = require('path');

const ConfigReader = require('../../../lib/config/config-reader');
const defaults = require('../../../lib/config/defaults');

describe('config-reader', () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => sandbox.restore());

    const mkReader_ = (opts) => new ConfigReader(opts || {});

    describe('read', () => {
        beforeEach(() => sandbox.stub(ConfigReader.prototype, 'getConfigFromFile'));

        it('should get default option if it does not set in config or cli', () => {
            const reader = mkReader_();
            reader.getConfigFromFile.returns({});

            const result = reader.read();

            assert.equal(result.conf, defaults.conf);
        });

        it('should override default option if it was set in config', () => {
            const reader = mkReader_();
            reader.getConfigFromFile.returns({conf: 'hermione.js'});

            const result = reader.read();

            assert.equal(result.conf, 'hermione.js');
        });

        it('should override option specified from config if it was set from cli', () => {
            const cliConfig = {conf: 'hermione.js'};
            const reader = mkReader_(cliConfig);

            reader.getConfigFromFile.returns({conf: 'hermione.yaml'});

            const result = reader.read();

            assert.equal(result.conf, 'hermione.js');
        });

        it('should call prepareEnvironment function if it set in config', () => {
            const prepareEnvironment = sinon.spy().named('prepareEnvironment');
            const reader = mkReader_({prepareEnvironment});

            const result = reader.read();

            assert.isTrue(result.prepareEnvironment.calledOnce);
        });

        it('should not call prepareEnvironment function if it is not set in config', () => {
            const prepareEnvironment = sinon.spy().named('prepareEnvironment');
            const reader = mkReader_({conf: 'hermione.js'});

            const result = reader.read();

            assert.isNull(result.prepareEnvironment);
            assert.isTrue(prepareEnvironment.notCalled);
        });
    });

    describe('getConfigFromFile', () => {
        it('should not throw on relative path to config file', () => {
            const reader = mkReader_();

            assert.doesNotThrow(() => reader.getConfigFromFile('./test/fixtures/.hermione.conf.js'));
        });

        it('should not throw on absolute path to config file', () => {
            const reader = mkReader_();
            const configPath = path.resolve(__dirname, '../../fixtures/.hermione.conf.js');

            assert.doesNotThrow(() => reader.getConfigFromFile(configPath));
        });
    });
});
