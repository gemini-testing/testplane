var chai = require('chai'),
    chaiAsPromised = require('chai-as-promised'),
    webdriverio = require('webdriverio'),
    _ = require('lodash');

module.exports = function(options) {

    chai.config.includeStack = options.includeStack;

    console.log(options.grid);

    var client = webdriverio.remote({
        host: options.grid,
        port: 4444,
        path: '/wd/hub',
        desiredCapabilities: require('./lib/browsers')(options.browser),
        waitforTimeout: options.waitforTimeout,
        logLevel: options.debug ? 'verbose' : 'silent',
        coloredLogs: true,
        screenshotPath: options.screenshotPath
    });

    client.on('error', function(e) {
        if(_.has(e, 'body.value.class')) {
            console.error('%s: message=%s',
                _.get(e, 'body.value.class'),
                _.get(e, 'body.value.message')
            );
        }
    });

    chai.use(chaiAsPromised);

    chai.should();

    chaiAsPromised.transferPromiseness = client.transferPromiseness;

    return {
        options: options,
        client: client,
        assert: chai.assert
    };

};
