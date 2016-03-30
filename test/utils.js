'use strict';

var _ = require('lodash'),
    Browser = require('../lib/browser');

function browserWithId(id) {
    var config = {browsers: {}};

    config.browsers[id] = {
        capabilities: {browserName: id}
    };

    return new Browser(config, id);
}

function makeConfigStub(opts) {
    opts = _.defaults(opts || {}, {
        specs: [],
        browsers: ['some-default-browser'],
        retry: 0
    });

    var config = {
        specs: opts.specs,
        browsers: {},
        reporters: [],
        plugins: opts.plugins
    };

    opts.browsers.forEach(function(browserId) {
        config.browsers[browserId] = {
            retry: opts.retry,
            desiredCapabilities: {browserName: browserId}
        };
    });

    return config;
}

exports.browserWithId = browserWithId;
exports.makeConfigStub = makeConfigStub;
