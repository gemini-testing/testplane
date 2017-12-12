'use strict';

const BrowserConfig = require('lib/config/browser-config');

describe('BrowserConfig', () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should contain a browser id', () => {
            const config = new BrowserConfig('bro');

            assert.equal(config.id, 'bro');
        });

        it('should be extended with passed options', () => {
            const config = new BrowserConfig('bro', {foo: 'bar'});

            assert.equal(config.foo, 'bar');
        });

        it('should contain a system options', () => {
            const config = new BrowserConfig('bro', {}, {foo: 'bar'});

            assert.deepEqual(config.system, {foo: 'bar'});
        });
    });

    describe('getScreenshotPath', () => {
        it('should return full screenshot path for current test state', () => {
            const test = {id: () => '12345'};
            const config = new BrowserConfig('bro', {screenshotsDir: 'scrs'});
            sandbox.stub(process, 'cwd').returns('/def/path');

            const res = config.getScreenshotPath(test, 'plain');

            assert.equal(res, '/def/path/scrs/12345/bro/plain.png');
        });

        it('should override screenshot path with result of "screenshotsDir" execution if it is function', () => {
            const config = new BrowserConfig('bro', {screenshotsDir: () => '/foo'});
            const res = config.getScreenshotPath({}, 'plain');

            assert.equal(res, '/foo/plain.png');
        });
    });
});
