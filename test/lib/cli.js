'use strict';

const q = require('q');
const globExtra = require('glob-extra');
const cli = require('../../lib/cli');
const logger = require('../../lib/utils').logger;
const ConfigReader = require('../../lib/config-reader');

const CONFIG = require('../fixtures/.hermione.conf.js');

describe('exit codes', () => {
    const sandbox = sinon.sandbox.create();

    beforeEach(() => {
        sandbox.stub(globExtra, 'expandPaths').returns(q([]));
        sandbox.stub(logger);
        sandbox.stub(process, 'exit');
        sandbox.stub(ConfigReader.prototype, 'read');
    });

    afterEach(() => sandbox.restore());

    describe('config validity', () => {
        it('should exit with code 0 if config is ok', () => {
            ConfigReader.prototype.read.returns(CONFIG);

            return cli.run().finally(() => assert.calledWith(process.exit, 0));
        });

        it('should exit with code 1 if config can not be read', () => {
            ConfigReader.prototype.read.throws(new Error('Unable to read config'));

            return cli.run().finally(() => assert.calledWith(process.exit, 1));
        });
    });
});
