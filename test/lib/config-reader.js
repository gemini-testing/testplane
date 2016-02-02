'use strict';

var ConfigReader = require('../../lib/config-reader'),
    defaults = require('../../lib/defaults');

describe('config-reader', function() {
    var sandbox = sinon.sandbox.create();

    afterEach(function() {
        sandbox.restore();
    });

    function mkReader_(opts) {
        var reader = new ConfigReader(opts || {});
        sandbox.stub(reader, 'getConfigFromFile');
        return reader;
    }

    it('should get default option if it does not set in config or from cli', function() {
        var reader = mkReader_();

        reader.getConfigFromFile.returns({});

        var result = reader.read();
        assert.equal(result.timeout, defaults.timeout);
    });

    it('should override default option if it was set in config', function() {
        var reader = mkReader_();

        reader.getConfigFromFile.returns({timeout: 5});

        var result = reader.read();
        assert.equal(result.timeout, 5);
    });

    it('should override option specified from config if it was set from cli', function() {
        var reader = mkReader_({timeout: 10});

        reader.getConfigFromFile.returns({timeout: 5});

        var result = reader.read();
        assert.equal(result.timeout, 10);
    });

    describe('per browser options', function() {
        it('should set sessionsPerBrowser option to all browsers', function() {
            var reader = mkReader_();

            reader.getConfigFromFile.returns({
                browsers: {
                    b1: {},
                    b2: {}
                }
            });

            var config = reader.read();

            assert.isDefined(defaults.sessionsPerBrowser);
            assert.equal(config.browsers.b1.sessionsPerBrowser, defaults.sessionsPerBrowser);
            assert.equal(config.browsers.b2.sessionsPerBrowser, defaults.sessionsPerBrowser);
        });

        it('should override sessionsPerBrowser per browser', function() {
            var reader = mkReader_();

            reader.getConfigFromFile.returns({
                browsers: {
                    b1: {},
                    b2: {
                        sessionsPerBrowser: 2
                    }
                }
            });

            var config = reader.read();

            assert.equal(config.browsers.b1.sessionsPerBrowser, defaults.sessionsPerBrowser);
            assert.equal(config.browsers.b2.sessionsPerBrowser, 2);
        });
    });
});
