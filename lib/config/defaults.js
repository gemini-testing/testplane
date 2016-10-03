'use strict';

module.exports = {
    baseUrl: 'http://localhost',
    gridUrl: 'http://localhost:4444/wd/hub',
    config: '.hermione.conf.js',
    desiredCapabilities: null,
    screenshotPath: null,
    prepareBrowser: null,
    prepareEnvironment: null,
    specs: null,
    waitTimeout: 1000,
    reporters: ['flat'],
    debug: false,
    sessionsPerBrowser: 1,
    retry: 0,
    mochaOpts: {
        slow: 10000,
        timeout: 60000
    }
};
