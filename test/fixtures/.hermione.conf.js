'use strict';
module.exports = {
    specs: [
        'test-suites/desktop'
    ],
    browsers: {
        chrome: {
            capabilities: {
                browserName: 'chrome',
                version: '45'
            },
            sessionsPerBrowser: 5
        }
    }
};
