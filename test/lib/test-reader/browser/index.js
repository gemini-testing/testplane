'use strict';

const BrowserConfigurator = require('lib/test-reader/browser');
const commands = require('lib/test-reader/browser/commands');

describe('BrowserConfigurator', () => {
    const sandbox = sinon.sandbox.create();
    let config;

    beforeEach(() => {
        sandbox.stub(commands.VersionCommand.prototype, 'execute');
        sandbox.stub(commands.VersionCommand.prototype, 'handleTest');
        sandbox.stub(commands.VersionCommand.prototype, 'handleSuite');
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('exposeAPI', () => {
        it('should throw if there is no a passed browser in an allowed browser list', () => {
            const configurator = new BrowserConfigurator('some-browser', []);
            const execute = configurator.exposeAPI();

            assert.throws(() => execute('browser-name'));
        });
    });

    describe('commands', () => {
        describe('version', () => {
            it('should NOT call the "execute" method if a required browser does not equal to a browser of instance', () => {
                const allowedBrowsers = ['browser2'];
                const instanceBrowser = 'browser1';
                const requiredBrowser = 'browser2';
                const configurator = new BrowserConfigurator(instanceBrowser, allowedBrowsers);
                const execute = configurator.exposeAPI();

                execute(requiredBrowser)
                    .version('v1')
                    .version('v2');

                assert.notCalled(commands.VersionCommand.prototype.execute);
            });

            it('should call the "execute" method', () => {
                const allowedBrowsers = ['browser2'];
                const instanceBrowser = 'browser2';
                const requiredBrowser = 'browser2';
                const configurator = new BrowserConfigurator(instanceBrowser, allowedBrowsers);
                const execute = configurator.exposeAPI();

                execute(requiredBrowser).version('v1');

                assert.calledOnceWith(commands.VersionCommand.prototype.execute, 'v1');
            });

            it('should chain an api', () => {
                const allowedBrowsers = ['browser2'];
                const instanceBrowser = 'browser2';
                const requiredBrowser = 'browser2';
                const configurator = new BrowserConfigurator(instanceBrowser, allowedBrowsers);
                const execute = configurator.exposeAPI();
                const api = execute(requiredBrowser);

                assert.equal(api.version('v1'), api);
            });

            it('should handle "test"', () => {
                const configurator = new BrowserConfigurator(config, 'some-browser');

                configurator.handleTest('test');

                assert.calledOnceWith(commands.VersionCommand.prototype.handleTest, 'test');
            });

            it('should handle "suite"', () => {
                const configurator = new BrowserConfigurator(config, 'some-browser');

                configurator.handleSuite('suite');

                assert.calledOnceWith(commands.VersionCommand.prototype.handleSuite, 'suite');
            });
        });
    });
});
