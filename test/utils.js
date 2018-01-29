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
    config.serialize = sinon.stub().returns(config);

    return config;
}

function makeSuite(opts = {}) {
    return _.defaults(opts, {
        root: false,
        id: () => 'default-id',
        parent: {root: true},
        title: 'default-suite',
        fullTitle: () => 'default-suite'
    });
}

function makeTest(opts = {}) {
    return _.defaults(opts, {
        parent: makeSuite(),
        title: 'default-test',
        browserId: 'yabro'
    });
}

exports.browserWithId = browserWithId;
exports.makeConfigStub = makeConfigStub;
exports.makeSuite = makeSuite;
exports.makeTest = makeTest;
