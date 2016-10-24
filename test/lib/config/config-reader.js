'use strict';

const _ = require('lodash');
const path = require('path');
const proxyquire = require('proxyquire').noCallThru();
const defaults = require('../../../lib/config/defaults');

describe('config-reader', () => {
    const sandbox = sinon.sandbox.create();

    const mkConfigData_ = (configPath, configStub) => {
        configPath = path.resolve(process.cwd(), configPath);
        return _.set({}, [configPath], configStub);
    };

    const mkReader_ = (cliConfig, fileConfig) => {
        cliConfig = _.defaults(cliConfig || {}, {
            prepareEnvironment: sandbox.stub(),
            prepareBrowser: sandbox.stub()
        });
        fileConfig = fileConfig || {};

        const configPath = cliConfig.config || defaults.config;
        const configStub = sandbox.stub().named('configFromFile').returns(fileConfig);
        const configData = mkConfigData_(configPath, configStub);

        const ConfigReader = proxyquire('../../../lib/config/config-reader', configData);

        return new ConfigReader(cliConfig);
    };

    afterEach(() => sandbox.restore());

    it('should get default option if it does not set in config or cli', () => {
        const result = mkReader_().read();

        assert.equal(result.config, defaults.config);
    });

    it('should override default option if it was set in config', () => {
        const reader = mkReader_({config: 'cliHermione.js'});
        const result = reader.read();

        assert.equal(result.config, 'cliHermione.js');
    });

    it('should override option specified from config if it was set from cli', () => {
        const reader = mkReader_({config: 'cliHermione.js'}, {config: 'fileHermione.js'});
        const result = reader.read();

        assert.equal(result.config, 'cliHermione.js');
    });

    it('should call prepareEnvironment function if it set in config', () => {
        const prepareEnvironment = sinon.spy().named('prepareEnvironment');
        const reader = mkReader_({prepareEnvironment});

        const result = reader.read();

        assert.calledOnce(result.prepareEnvironment);
    });

    it('should call prepareBrowser function if it is specified in config', () => {
        const prepareBrowser = sinon.spy().named('prepareBrowser');
        const reader = mkReader_({prepareBrowser});

        const result = reader.read();

        assert.calledOnce(result.prepareBrowser);
        assert.calledWith(result.prepareBrowser, sinon.match({
            desiredCapabilities: {
                browserName: 'firefox'
            }
        }));
    });

    it('should not throw on relative path to config file', () => {
        const reader = mkReader_({config: './test/cliHermione.js'});

        assert.doesNotThrow(() => reader.read());
    });

    it('should not throw on absolute path to config file', () => {
        const absolutePath = path.resolve(__dirname, '../../test/cliHermione.js');
        const reader = mkReader_({config: absolutePath});

        assert.doesNotThrow(() => reader.read());
    });
});
