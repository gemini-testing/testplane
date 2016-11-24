'use strict';

const _ = require('lodash');
const Browser = require('../lib/browser');

function browserWithId(id) {
    const config = {browsers: {}, system: {debug: false}};

    config.forBrowser = () => ({capabilities: {browserName: id}});

    return new Browser(config, id);
}

function makeConfigStub(opts) {
    opts = _.defaults(opts || {}, {
        browsers: ['some-default-browser'],
        retry: 0
    });

    const config = {
        browsers: {},
        plugins: opts.plugins,
        system: opts.system || {mochaOpts: {}},
        sets: opts.sets || {}
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
