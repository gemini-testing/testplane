// TODO синхронизировать с gemini
var browsers = {
    'desktop-chrome': {
        desiredCapabilities: {
            browserName: 'chrome'
        }
    },

    'desktop-firefox': {
        desiredCapabilities: {
            browserName: 'firefox'
        }
    },

    'desktop-ie9': {
        desiredCapabilities: {
            browserName: 'internet explorer',
            version: 9
        }
    },

    'desktop-ie11': {
        windowSize: '1650x1050',
        desiredCapabilities: {
            browserName: 'internet explorer',
            version: 11
        }
    },

    'desktop-phantomjs': {
        desiredCapabilities: {
            browserName: 'phantomjs'
        }
    },

    'touch-phone-chrome': {
        desiredCapabilities: {
            browserName: 'chrome',
            calibrate: false,
            chromeOptions: {
                mobileEmulation: {
                    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X)'
                    + ' AppleWebKit/600.1.3 (KHTML, like Gecko) Version/8.0 Mobile/12A4345d Safari/600.1.4',
                    deviceMetrics: {
                         width: 320,
                         height: 568,
                         pixelRatio: 1
                     }
                }
            }
        }
    },

    // Яндекс.Приложение под Android
    'touch-phone-app': {
        desiredCapabilities: {
            browserName: 'chrome',
            calibrate: false,
            chromeOptions: {
                mobileEmulation: {
                    userAgent: 'Mozilla/5.0 (Linux; Android 4.4.2; SM-G900F Build/KOT49H) AppleWebKit/537.36'
                    + ' (KHTML, like Gecko) Version/4.0 Chrome/30.0.0.0 Mobile Safari/537.36 YandexSearch/4.65',
                    deviceMetrics: {
                        width: 320,
                        height: 568,
                        pixelRatio: 1
                    }
                }
            }
        }
    }
};

module.exports = function(alias) {
    if(browsers[alias]) {
        return browsers[alias];
    } else {
        throw new Error('Неизвестный браузер ' + alias);
    }
};
