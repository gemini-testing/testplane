'use strict';

const DEFAULT_HTTP_TIMEOUT = 90000;

module.exports = {
    baseUrl: 'http://localhost',
    gridUrl: 'http://localhost:4444/wd/hub',
    config: '.hermione.conf.js',
    desiredCapabilities: null,
    screenshotPath: null,
    prepareBrowser: null,
    prepareEnvironment: null,
    waitTimeout: 1000,
    httpTimeout: DEFAULT_HTTP_TIMEOUT,
    sessionRequestTimeout: DEFAULT_HTTP_TIMEOUT,
    sessionQuitTimeout: DEFAULT_HTTP_TIMEOUT,
    reporters: ['flat'],
    debug: false,
    sessionsPerBrowser: 1,
    retry: 0,
    mochaOpts: {
        slow: 10000,
        timeout: 60000
    },
    meta: null
};
