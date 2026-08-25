import path from "path";

const SERVER_PORT = 3000;

export default {
    gridUrl: "http://127.0.0.1:4444/",

    baseUrl: `http://host.docker.internal:${SERVER_PORT}/`,

    timeTravel: "on",
    saveHistoryMode: "all",

    screenshotsDir: "test/e2e/screens",

    sets: {
        assertView: {
            files: path.join(__dirname, "tests/assert-view.testplane.js"),
            browsers: ["chrome"],
        },
        reportPageScreenshot: {
            files: path.join(__dirname, "tests/report-page-screenshot.testplane.js"),
            browsers: ["chrome"],
        },
        calibrationResize: {
            files: path.join(__dirname, "tests/calibration-resize.testplane.js"),
            browsers: ["calibrated-chrome"],
        },
        dprOopif: {
            files: path.join(__dirname, "tests/dpr-oopif.testplane.js"),
            browsers: ["chrome-dpr-3"],
        },
    },

    takeScreenshotOnFails: {
        testFail: false,
        assertViewFail: false,
    },

    browsers: {
        chrome: {
            assertViewOpts: {
                ignoreDiffPixelCount: 4,
            },
            windowSize: "1280x1024",
            desiredCapabilities: {
                browserName: "chrome",
                "goog:chromeOptions": {
                    args: ["headless", "no-sandbox", "hide-scrollbars", "disable-dev-shm-usage"],
                },
            },
            waitTimeout: 3000,
        },
        "calibrated-chrome": {
            assertViewOpts: {
                ignoreDiffPixelCount: 4,
            },
            calibrate: true,
            windowSize: "360x640",
            desiredCapabilities: {
                browserName: "chrome",
                "goog:chromeOptions": {
                    args: ["headless", "no-sandbox", "hide-scrollbars", "disable-dev-shm-usage"],
                },
            },
            waitTimeout: 3000,
        },
        "chrome-dpr-3": {
            headless: false,
            assertViewOpts: {
                ignoreDiffPixelCount: 4,
            },
            isolation: false,
            saveHistoryMode: "none",
            timeTravel: "off",
            desiredCapabilities: {
                browserName: "chrome",
                "goog:chromeOptions": {
                    args: [
                        // "headless",
                        "no-sandbox",
                        "hide-scrollbars",
                        "disable-gpu",
                        "disable-dev-shm-usage",
                        "--host-resolver-rules=MAP localhost host.docker.internal,MAP 127.0.0.1 host.docker.internal",
                    ],
                    mobileEmulation: {
                        deviceMetrics: {
                            width: 390,
                            height: 844,
                            pixelRatio: 3,
                            mobile: true,
                            touch: true,
                        },
                    },
                },
            },
            waitTimeout: 3000,
        },
    },

    devServer: {
        command: `npx --yes --prefer-offline serve -p ${SERVER_PORT} --no-request-logging ${path.resolve(
            __dirname,
            "static",
        )}`,
        readinessProbe: {
            url: `http://localhost:${SERVER_PORT}/`,
            timeouts: {
                waitServerTimeout: 60_000,
            },
        },
    },

    plugins: {
        "html-reporter/testplane": {
            enabled: true,
            path: "test/e2e/report",
        },
    },
};
