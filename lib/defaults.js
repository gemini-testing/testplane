'use strict';

module.exports = {
    baseUrl: 'http://localhost',
    conf: './.e2e.conf.js',
    grid: 'http://localhost:4444/wd/hub',
    waitTimeout: 10000,
    screenshotPath: 'artifacts',
    slow: 10000,
    timeout: 60000,
    reporters: ['flat'],
    debug: false,
    sessionsPerBrowser: 1
};
