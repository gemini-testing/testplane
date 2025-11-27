import path from "path";

const SERVER_PORT = 3000;

export default {
    gridUrl: "http://127.0.0.1:4444/",

    baseUrl: `http://host.docker.internal:${SERVER_PORT}/`,

    timeTravel: "off",
    saveHistoryMode: "all",

    screenshotsDir: "test/e2e/screens",

    sets: {
        assertView: {
            files: path.join(__dirname, "tests/assert-view.testplane.js"),
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
                    binary: "/usr/bin/chromium",
                },
            },
            waitTimeout: 3000,
        },
    },

    devServer: {
        command: `npx --yes serve -p ${SERVER_PORT} --no-request-logging test/e2e/test-pages/`,
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
