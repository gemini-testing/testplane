'use strict';

const commands = require('lib/test-reader/browser/commands');

describe('VersionCommand', () => {
    describe('test', () => {
        it('should apply the version', () => {
            const command = new commands.VersionCommand();
            const test = {};

            command.execute('v1.2');
            command.handleTest(test);

            assert.deepEqual(test, {browserVersion: 'v1.2'});
        });

        it('should apply the version once', () => {
            const command = new commands.VersionCommand();
            const test = {};

            command.execute('v1.2');
            command.handleTest({});
            command.handleTest(test);

            assert.deepEqual(test, {});
        });

        it('should apply the version even if there is a version for a suite ', () => {
            const command = new commands.VersionCommand();
            const test = {};

            command.execute('v1.2');
            command.handleSuite();
            command.execute('v1.3');
            command.handleTest(test);

            assert.deepEqual(test, {browserVersion: 'v1.3'});
        });
    });

    describe('suite', () => {
        it('should apply the version for a suite', () => {
            const command = new commands.VersionCommand();
            const test1 = {};
            const test2 = {};

            command.execute('v1.2');
            command.handleSuite();
            command.handleTest(test1);
            command.handleTest(test2);

            assert.deepEqual(test1, {browserVersion: 'v1.2'});
            assert.deepEqual(test2, {browserVersion: 'v1.2'});
        });

        it('should apply the version for a nested suite', () => {
            const command = new commands.VersionCommand();
            const test = {};

            command.execute('v1.2');
            command.handleSuite();
            command.handleTest({});
            command.handleSuite();
            command.handleTest(test);

            assert.deepEqual(test, {browserVersion: 'v1.2'});
        });

        it('should apply the version for a suite after a test version has applied', () => {
            const command = new commands.VersionCommand();
            const test = {};

            command.execute('v1.2');
            command.handleSuite();
            command.execute('v1.3');
            command.handleTest();
            command.handleTest(test);

            assert.deepEqual(test, {browserVersion: 'v1.2'});
        });
    });
});
