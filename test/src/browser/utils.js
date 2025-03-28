"use strict";

const _ = require("lodash");
const EventEmitter = require("events");
const { NewBrowser } = require("src/browser/new-browser");
const { ExistingBrowser } = require("src/browser/existing-browser");
const { WEBDRIVER_PROTOCOL } = require("src/constants/config");

export function createBrowserConfig_(opts = {}) {
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
        headers: null,
        transformRequest: null,
        transformResponse: null,
        strictSSL: null,
        user: null,
        key: null,
        region: null,
        headless: null,
        saveHistory: true,
        isolation: false,
        record: {
            mode: "off",
        },
    });

    return {
        baseUrl: "http://main_url",
        gridUrl: "http://main_host:4444/wd/hub",
        system: { debug: true },
        forBrowser: () => browser,
    };
}

export const mkWdPool_ = ({ gridUrl = "http://localhost:12345/wd/local" } = {}) => ({
    getWebdriver: sinon
        .stub()
        .named("getWebdriver")
        .resolves({
            gridUrl,
            free: sinon.stub().named("free"),
            kill: sinon.stub().named("kill"),
        }),
});

export const mkNewBrowser_ = (
    configOpts,
    opts = {
        id: "browser",
        version: "1.0",
        state: {},
        wdPool: mkWdPool_(),
    },
    BrowserClass = NewBrowser,
) => {
    return BrowserClass.create(createBrowserConfig_(configOpts), opts);
};

export const mkExistingBrowser_ = (
    configOpts,
    opts = { id: "browser", version: "1.0", state: {}, emitter: "emitter" },
    BrowserClass = ExistingBrowser,
) => {
    return BrowserClass.create(createBrowserConfig_(configOpts), opts);
};

export const mkMockStub_ = () => {
    const eventEmitter = new EventEmitter();

    return {
        on: sinon.spy(eventEmitter, "on"),
        emit: sinon.spy(eventEmitter, "emit"),
        restore: sinon.stub().resolves(),
    };
};

export const mkCDPTarget_ = () => ({
    _targetId: "12345",
});

export const mkCDPPage_ = () => ({
    target: sinon.stub().named("target").returns(mkCDPTarget_()),
    close: sinon.stub().named("close").resolves(),
});

export const mkCDPBrowserCtx_ = () => ({
    newPage: sinon.stub().named("newPage").resolves(mkCDPPage_()),
    isIncognito: sinon.stub().named("isIncognito").returns(false),
    pages: sinon.stub().named("pages").resolves([]),
    close: sinon.stub().named("close").resolves(),
});

export const mkCDPStub_ = () => ({
    browserContexts: sinon.stub().named("browserContexts").returns([]),
    createIncognitoBrowserContext: sinon.stub().named("createIncognitoBrowserContext").resolves(mkCDPBrowserCtx_()),
});

export const mkSessionStub_ = () => {
    const session = {};
    const wdioElement = {
        selector: ".selector",
        click: sinon.stub().named("click").resolves(),
        waitForExist: sinon.stub().named("waitForExist").resolves(),
    };

    session.sessionId = "1234567890";
    session.isW3C = false;
    session.isBidi = false;

    session.options = {};
    session.capabilities = {};
    session.commandList = [];
    session.executionContext = {
        ctx: {
            currentTest: {
                file: "/default",
            },
        },
    };

    session.deleteSession = sinon.stub().named("end").resolves();
    session.clearSession = sinon.stub().named("clearSession").resolves();
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
    session.getPuppeteer = sinon.stub().named("getPuppeteer").resolves(mkCDPStub_());
    session.$ = sinon.stub().named("$").resolves(wdioElement);
    session.mock = sinon.stub().named("mock").resolves(mkMockStub_());
    session.getWindowHandles = sinon.stub().named("getWindowHandles").resolves([]);
    session.switchToWindow = sinon.stub().named("switchToWindow").resolves();
    session.findElements = sinon.stub().named("findElements").resolves([]);
    session.switchToFrame = sinon.stub().named("switchToFrame").resolves();
    session.switchToParentFrame = sinon.stub().named("switchToParentFrame").resolves();
    session.switchToRepl = sinon.stub().named("switchToRepl").resolves();
    session.deleteAllCookies = sinon.stub().named("deleteAllCookies").resolves();

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
