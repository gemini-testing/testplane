'use strict';

var Browser = require('../lib/browser');

function browserWithId(id) {
    var config = {browsers: {}};

    config.browsers[id] = {
        capabilities: {browserName: id}
    };

    return new Browser(config, id);
}

function createConfig(browsers, suites) {
    browsers = browsers
        ? Array.isArray(browsers) ? browsers : [browsers]
        : ['id'];

    suites = suites
        ? Array.isArray(suites) ? suites : [suites]
        : ['spec'];

    var config = {
        tests: suites,
        browsers: {}
    };

    browsers.forEach(function(browserId) {
        config.browsers[browserId] = {
            capabilities: {browserName: browserId}
        };
    });

    return config;
}

exports.browserWithId = browserWithId;
exports.createConfg = createConfig;
