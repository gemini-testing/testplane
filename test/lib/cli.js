'use strict';
const pathUtils = require('../../lib/path-utils');
const q = require('q');

var cli = require('../../lib/cli'),
    logger = require('../../lib/utils').logger,
    ConfigReader = require('../../lib/config-reader'),

    CONFIG = require('../fixtures/.hermione.conf.js');

describe('exit codes', function() {
    var sandbox = sinon.sandbox.create();

    beforeEach(function() {
        sandbox.stub(pathUtils, 'expandPaths').returns(q([]));
        sandbox.stub(logger);
        sandbox.stub(process, 'exit');
        sandbox.stub(ConfigReader.prototype, 'read');
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('config validity', function() {
        it('should exit with code 0 if config is ok', function() {
            ConfigReader.prototype.read.returns(CONFIG);

            return cli.run().finally(function() {
                assert.calledWith(process.exit, 0);
            });
        });

        it('should exit with code 1 if config can not be read', function() {
            ConfigReader.prototype.read.throws(new Error('Unable to read config'));

            return cli.run().finally(function() {
                assert.calledWith(process.exit, 1);
            });
        });
    });
});
