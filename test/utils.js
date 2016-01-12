'use strict';

var Browser = require('../lib/browser');

function browserWithId(id) {
    var config = {browsers: {}};

    config.browsers[id] = {
        capabilities: {browserName: id}
    };

    return new Browser(config, id);
}

function createConfig(browsers) {
    browsers = browsers
        ? Array.isArray(browsers) ? browsers : [browsers]
        : ['id'];

    var config = {
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
