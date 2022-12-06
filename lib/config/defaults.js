'use strict';

const {WEBDRIVER_PROTOCOL} = require('../constants/config');

module.exports = {
    baseUrl: 'http://localhost',
    gridUrl: 'http://localhost:4444/wd/hub',
    config: '.hermione.conf.js',
    desiredCapabilities: null,
    automationProtocol: WEBDRIVER_PROTOCOL,
    sessionEnvFlags: {},
    screenshotsDir: 'hermione/screens',
    diffColor: '#ff00ff',
    tolerance: 2.3,
    antialiasingTolerance: 4,
    compareOpts: {
        shouldCluster: false,
        clustersSize: 10,
        stopOnFirstFail: false
    },
    buildDiffOpts: {
        ignoreAntialiasing: true,
        ignoreCaret: true
    },
    assertViewOpts: {
        ignoreElements: [],
        captureElementFromTop: true,
        allowViewportOverflow: false
    },
    calibrate: false,
    screenshotMode: 'auto',
    screenshotDelay: 0,
    compositeImage: true,
    prepareBrowser: null,
    prepareEnvironment: null,
    waitTimeout: 3000,
    waitInterval: 500,
    httpTimeout: 30000,
    urlHttpTimeout: null,
    pageLoadTimeout: 20000,
    sessionRequestTimeout: null,
    sessionQuitTimeout: 5000,
    testTimeout: null,
    takeScreenshotOnFails: {
        testFail: true,
        assertViewFail: true
    },
    takeScreenshotOnFailsTimeout: 5000,
    takeScreenshotOnFailsMode: 'fullpage',
    reporters: ['flat'],
    debug: false,
    parallelLimit: Infinity,
    sessionsPerBrowser: 1,
    testsPerSession: Infinity,
    workers: 1,
    testsPerWorker: Infinity,
    retry: 0,
    shouldRetry: null,
    mochaOpts: {
        slow: 10000,
        timeout: 60000
    },
    expectOpts: {
        wait: 3000,
        interval: 100
    },
    patternsOnReject: [],
    meta: null,
    windowSize: null,
    tempDir: '',
    orientation: null,
    waitOrientationChange: true,
    resetCursor: true,
    strictTestsOrder: false,
    saveHistory: true,
    fileExtensions: ['.js', '.mjs'],
    outputDir: null,
    agent: null,
    headers: null,
    transformRequest: null,
    transformResponse: null,
    strictSSL: null,
    user: null,
    key: null,
    region: null,
    headless: null
};
