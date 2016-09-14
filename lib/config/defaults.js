'use strict';

module.exports = {
    baseUrl: 'http://localhost',
    conf: '.hermione.conf.js',
    grid: 'http://localhost:4444/wd/hub',
    waitTimeout: 1000,
    desiredCapabilities: null,
    screenshotPath: null,
    prepareBrowser: null,
    prepareEnvironment: null,
    specs: null,
    reporters: ['flat'],
    debug: false,
    sessionsPerBrowser: 1,
    retry: 0,
    mochaOpts: {
        slow: 10000,
        timeout: 60000
    }
};
