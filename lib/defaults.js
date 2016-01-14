'use strict';

module.exports = {
    baseUrl: 'http://localhost',
    conf: './.e2e.conf.js',
    grid: 'http://localhost:4444/wd/hub',
    waitTimeout: 10000,
    screenshotPath: null,
    reporters: ['flat'],
    debug: false,
    sessionsPerBrowser: 1,
    mochaOpts: {
        slow: 10000,
        timeout: 60000
    }
};
