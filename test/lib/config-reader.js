'use strict';

const path = require('path');
const ConfigReader = require('../../lib/config-reader');
const defaults = require('../../lib/defaults');

describe('config-reader', () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => sandbox.restore());

    const mkReader_ = (opts) => {
        const reader = new ConfigReader(opts || {});

        sandbox.stub(reader, 'getConfigFromFile');

        return reader;
    };

    it('should get default option if it does not set in config or from cli', () => {
        const reader = mkReader_();

        reader.getConfigFromFile.returns({});

        const result = reader.read();
        assert.equal(result.timeout, defaults.timeout);
    });

    it('should override default option if it was set in config', () => {
        const reader = mkReader_();

        reader.getConfigFromFile.returns({timeout: 5});

        const result = reader.read();
        assert.equal(result.timeout, 5);
    });

    it('should override option specified from config if it was set from cli', () => {
        const reader = mkReader_({timeout: 10});

        reader.getConfigFromFile.returns({timeout: 5});

        const result = reader.read();
        assert.equal(result.timeout, 10);
    });

    it('should not throw on relative path to config file', () => {
        const reader = new ConfigReader({});
        const conf = './test/fixtures/.hermione.conf.js';

        assert.doesNotThrow(() => reader.getConfigFromFile(conf));
    });

    it('should not throw on absolute path to config file', () => {
        const reader = new ConfigReader({});
        const conf = path.resolve(__dirname, '../fixtures/.hermione.conf.js');

        assert.doesNotThrow(() => reader.getConfigFromFile(conf));
    });

    it('should add grep option to mochaOpts if grep passed from CLI', () => {
        const reader = mkReader_({grep: 'foo'});
        const config = reader.read();

        assert.equal(config.mochaOpts.grep, 'foo');
    });

    describe('per browser options', () => {
        it('should set sessionsPerBrowser option to all browsers', () => {
            const reader = mkReader_();

            reader.getConfigFromFile.returns({
                browsers: {
                    b1: {},
                    b2: {}
                }
            });

            const config = reader.read();

            assert.isDefined(defaults.sessionsPerBrowser);
            assert.equal(config.browsers.b1.sessionsPerBrowser, defaults.sessionsPerBrowser);
            assert.equal(config.browsers.b2.sessionsPerBrowser, defaults.sessionsPerBrowser);
        });

        it('should override sessionsPerBrowser per browser', () => {
            const reader = mkReader_();

            reader.getConfigFromFile.returns({
                browsers: {
                    b1: {},
                    b2: {
                        sessionsPerBrowser: 2
                    }
                }
            });

            const config = reader.read();

            assert.equal(config.browsers.b1.sessionsPerBrowser, defaults.sessionsPerBrowser);
            assert.equal(config.browsers.b2.sessionsPerBrowser, 2);
        });

        it('should set retry option to all browsers', () => {
            const reader = mkReader_();

            reader.getConfigFromFile.returns({
                browsers: {
                    b1: {},
                    b2: {}
                }
            });

            const config = reader.read();

            assert.isDefined(defaults.retry);
            assert.equal(config.browsers.b1.retry, defaults.retry);
            assert.equal(config.browsers.b2.retry, defaults.retry);
        });

        it('should override retry option per browser', () => {
            const reader = mkReader_();

            reader.getConfigFromFile.returns({
                browsers: {
                    b1: {},
                    b2: {
                        retry: 2
                    }
                }
            });

            const config = reader.read();

            assert.equal(config.browsers.b1.retry, defaults.retry);
            assert.equal(config.browsers.b2.retry, 2);
        });
    });
});
