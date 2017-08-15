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
        retry: 0,
        sessionsPerBrowser: 1,
        testsPerSession: Infinity,
        configPath: 'some-default-config-path'
    });

    const config = {
        browsers: {},
        plugins: opts.plugins,
        system: opts.system || {mochaOpts: {}},
        sets: opts.sets || {},
        configPath: opts.configPath
    };

    opts.browsers.forEach(function(browserId) {
        config.browsers[browserId] = {
            retry: opts.retry,
            sessionsPerBrowser: opts.sessionsPerBrowser,
            testsPerSession: opts.testsPerSession,
            desiredCapabilities: {browserName: browserId}
        };
    });

    config.forBrowser = (browserId) => config.browsers[browserId];
    config.getBrowserIds = () => _.keys(config.browsers);

    return config;
}

exports.browserWithId = browserWithId;
exports.makeConfigStub = makeConfigStub;
