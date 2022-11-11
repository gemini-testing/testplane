'use strict';

const _ = require('lodash');
const Browser = require('../lib/browser/new-browser');

function browserWithId(id) {
    const config = {browsers: {}, system: {debug: false}};

    config.forBrowser = () => ({capabilities: {browserName: id}});

    return new Browser(config, id);
}

function makeConfigStub(opts = {}, DEFAULT_BROWSER_NAME) {
    opts = _.defaults(opts, {
        browsers: [DEFAULT_BROWSER_NAME],
        version: '1.0',
        desiredCapabilities: {},
        retry: 0,
        sessionsPerBrowser: 1,
        testsPerSession: Infinity,
        configPath: 'some-default-config-path',
        resetCursor: true,
        system: {
            mochaOpts: {},
            patternsOnReject: []
        },
        sets: {}
    });

    const config = {
        browsers: {},
        plugins: opts.plugins,
        system: opts.system,
        sets: opts.sets,
        configPath: opts.configPath
    };

    opts.browsers.forEach(function(browserId) {
        config.browsers[browserId] = {
            retry: opts.retry,
            shouldRetry: opts.shouldRetry,
            sessionsPerBrowser: opts.sessionsPerBrowser,
            testsPerSession: opts.testsPerSession,
            desiredCapabilities: _.isEmpty(opts.desiredCapabilities)
                ? {browserName: browserId, version: opts.version}
                : opts.desiredCapabilities,
            testTimeout: opts.testTimeout,
            system: opts.system
        };
    });

    config.forBrowser = (browserId) => config.browsers[browserId];
    config.getBrowserIds = () => _.keys(config.browsers);
    config.serialize = sinon.stub().returns(config);
    config.mergeWith = sinon.stub();

    return config;
}

function makeSuite(opts = {}) {
    return _.defaults(opts, {
        root: false,
        id: () => 'default-id',
        parent: {root: true},
        title: 'default-suite',
        fullTitle: () => 'default-suite',
        eachTest: () => {}
    });
}

function makeTest(opts = {}) {
    return _.defaults(opts, {
        id: 'some-default-id',
        parent: makeSuite(),
        title: 'default-test',
        browserId: 'yabro',
        fullTitle: () => 'default-test'
    });
}

exports.browserWithId = browserWithId;
exports.makeConfigStub = makeConfigStub;
exports.makeSuite = makeSuite;
exports.makeTest = makeTest;
