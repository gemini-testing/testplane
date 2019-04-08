'use strict';

const _ = require('lodash');
const q = require('q');
const NewBrowser = require('lib/browser/new-browser');
const ExistingBrowser = require('lib/browser/existing-browser');

function createBrowserConfig_(opts = {}) {
    const browser = _.defaults(opts, {
        desiredCapabilities: {browserName: 'browser'},
        baseUrl: 'http://base_url',
        gridUrl: 'http://test_host:4444/wd/hub',
        waitTimeout: 100,
        screenshotPath: 'path/to/screenshots',
        httpTimeout: 3000,
        pageLoadTimeout: null,
        sessionRequestTimeout: null,
        sessionQuitTimeout: null,
        screenshotOnReject: true,
        screenshotOnRejectTimeout: 3000,
        screenshotDelay: 0,
        windowSize: null,
        getScreenshotPath: () => '/some/path',
        system: opts.system || {}
    });

    return {
        baseUrl: 'http://main_url',
        gridUrl: 'http://main_host:4444/wd/hub',
        system: {debug: true},
        forBrowser: () => browser
    };
}

exports.mkNewBrowser_ = (opts, browser = 'browser') => {
    return NewBrowser.create(createBrowserConfig_(opts), browser);
};

exports.mkExistingBrowser_ = (opts, browser = 'browser', emitter = 'emitter') => {
    return ExistingBrowser.create(createBrowserConfig_(opts), 'browser', emitter);
};

exports.mkSessionStub_ = () => {
    const session = q();
    session.commandList = [];
    session.init = sinon.stub().named('init').returns(session);
    session.end = sinon.stub().named('end').resolves();
    session.url = sinon.stub().named('url').returns(session);
    session.execute = sinon.stub().named('execute').resolves({});
    session.requestHandler = {defaultOptions: {}};
    session.screenshot = sinon.stub().named('screenshot').resolves({value: {}});
    session.setOrientation = sinon.stub().named('setOrientation').resolves({value: {}});
    session.windowHandleSize = sinon.stub().named('windowHandleSize').resolves({value: {}});
    session.orientation = sinon.stub().named('orientation').resolves({value: ''});
    session.waitUntil = sinon.stub().named('waitUntil').resolves();
    session.timeouts = sinon.stub().named('timeouts').resolves();

    session.addCommand = sinon.stub().callsFake((name, command) => {
        session[name] = command;
        sinon.spy(session, name);
    });

    return session;
};
