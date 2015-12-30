'use strict';

var ConfigReader = require('../../lib/config-reader'),
    defaults = require('../../lib/defaults');

describe('overrides', function() {
    var sandbox = sinon.sandbox.create();

    afterEach(function() {
        sandbox.restore();
    });

    it('should get default option if it does not set in config or from cli', function() {
        var reader = new ConfigReader('config/path', {});

        sandbox.stub(reader, 'getConfigFromFile').returns({});

        var result = reader.read();
        assert.equal(result.timeout, defaults.timeout);
    });

    it('should override default option if it was set in config', function() {
        var reader = new ConfigReader('config/path', {});

        sandbox.stub(reader, 'getConfigFromFile').returns({ timeout: 5 });

        var result = reader.read();
        assert.equal(result.timeout, 5);
    });

    it('should override option specified from config if it was set from cli', function() {
        var reader = new ConfigReader('config/path', { timeout: 10 });

        sandbox.stub(reader, 'getConfigFromFile').returns({ timeout: 5 });

        var result = reader.read();
        assert.equal(result.timeout, 10);
    });
});
