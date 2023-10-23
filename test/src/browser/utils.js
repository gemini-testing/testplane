"use strict";

const _ = require("lodash");
const EventEmitter = require("events");
const NewBrowser = require("src/browser/new-browser");
const ExistingBrowser = require("src/browser/existing-browser");
const { WEBDRIVER_PROTOCOL } = require("src/constants/config");

function createBrowserConfig_(opts = {}) {
    const browser = _.defaults(opts, {
        desiredCapabilities: { browserName: "browser", version: "1.0" },
        baseUrl: "http://base_url",
        gridUrl: "http://test_host:4444/wd/hub?query=value",
        automationProtocol: WEBDRIVER_PROTOCOL,
        sessionEnvFlags: {},
        outputDir: null,
        waitTimeout: 100,
        waitInterval: 50,
        httpTimeout: 3000,
        pageLoadTimeout: null,
        sessionRequestTimeout: null,
        sessionQuitTimeout: null,
        screenshotDelay: 0,
        windowSize: null,
        getScreenshotPath: () => "/some/path",
        system: opts.system || {},
        buildDiffOpts: {
            ignoreCaret: true,
        },
        waitOrientationChange: true,
        agent: null,
        headers: {},
        transformRequest: null,
        transformResponse: null,
        strictSSL: null,
        user: null,
        key: null,
        region: null,
        headless: null,
        saveHistory: true,
        isolation: false,
    });

    return {
        baseUrl: "http://main_url",
        gridUrl: "http://main_host:4444/wd/hub",
        system: { debug: true },
        forBrowser: () => browser,
    };
}

exports.mkNewBrowser_ = (opts, browser = "browser", version) => {
    return NewBrowser.create(createBrowserConfig_(opts), browser, version);
};

exports.mkExistingBrowser_ = (opts, browser = "browser", browserVersion, emitter = "emitter") => {
    return ExistingBrowser.create(createBrowserConfig_(opts), browser, browserVersion, emitter);
};

exports.mkMockStub_ = () => {
    const eventEmitter = new EventEmitter();

    return {
        on: sinon.spy(eventEmitter, "on"),
        emit: sinon.spy(eventEmitter, "emit"),
        restore: sinon.stub().resolves(),
    };
};

exports.mkSessionStub_ = () => {
    const session = {};
    const wdioElement = {
        selector: ".selector",
        click: sinon.stub().named("click").resolves(),
        waitForExist: sinon.stub().named("waitForExist").resolves(),
    };
    const wdElement = {
        "element-6066-11e4-a52e-4f735466cecf": "95777D6590AF653A2FD8EB0ADD20B333_element_1",
    };

    session.sessionId = "1234567890";
    session.isW3C = false;

    session.options = {};
    session.capabilities = {};
    session.commandList = [];

    session.deleteSession = sinon.stub().named("end").resolves();
    session.url = sinon.stub().named("url").resolves();
    session.getUrl = sinon.stub().named("getUrl").resolves("");
    session.execute = sinon.stub().named("execute").resolves();
    session.takeScreenshot = sinon.stub().named("takeScreenshot").resolves("");
    session.setWindowSize = sinon.stub().named("setWindowSize").resolves();
    session.getOrientation = sinon.stub().named("orientation").resolves("");
    session.setOrientation = sinon.stub().named("setOrientation").resolves();
    session.waitUntil = sinon.stub().named("waitUntil").resolves();
    session.setTimeout = sinon.stub().named("setTimeout").resolves();
    session.setTimeouts = sinon.stub().named("setTimeouts").resolves();
    session.getPuppeteer = sinon.stub().named("getPuppeteer").resolves(exports.mkCDPStub_());
    session.$ = sinon.stub().named("$").resolves(wdioElement);
    session.mock = sinon.stub().named("mock").resolves(exports.mkMockStub_());
    session.getWindowHandles = sinon.stub().named("getWindowHandles").resolves([]);
    session.switchToWindow = sinon.stub().named("switchToWindow").resolves();
    session.findElements = sinon.stub().named("findElements").resolves([wdElement]);
    session.switchToFrame = sinon.stub().named("switchToFrame").resolves();
    session.switchToParentFrame = sinon.stub().named("switchToParentFrame").resolves();

    session.addCommand = sinon.stub().callsFake((name, command, isElement) => {
        const target = isElement ? wdioElement : session;

        target[name] = command.bind(target);
        sinon.spy(target, name);
    });

    session.overwriteCommand = sinon.stub().callsFake((name, command, isElement) => {
        const target = isElement ? wdioElement : session;

        target[name] = command.bind(target, target[name]);
        sinon.spy(target, name);
    });

    return session;
};

exports.mkCDPStub_ = () => ({
    browserContexts: sinon.stub().named("browserContexts").returns([]),
    createIncognitoBrowserContext: sinon
        .stub()
        .named("createIncognitoBrowserContext")
        .resolves(exports.mkCDPBrowserCtx_()),
});

exports.mkCDPBrowserCtx_ = () => ({
    newPage: sinon.stub().named("newPage").resolves(exports.mkCDPPage_()),
    isIncognito: sinon.stub().named("isIncognito").returns(false),
    pages: sinon.stub().named("pages").resolves([]),
    close: sinon.stub().named("close").resolves(),
});

exports.mkCDPPage_ = () => ({
    target: sinon.stub().named("target").returns(exports.mkCDPTarget_()),
    close: sinon.stub().named("close").resolves(),
});

exports.mkCDPTarget_ = () => ({
    _targetId: "12345",
});
