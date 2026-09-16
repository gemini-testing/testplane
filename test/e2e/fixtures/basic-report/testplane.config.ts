import path from "path";
import Module from "module";

const moduleAliasesPath = path.resolve(__dirname, "../../module-aliases");

// In this repository Testplane is the package root, not an installed peer dependency.
// Expose its built entry point so html-reporter can detect Time Travel while generating the fixture.
process.env.NODE_PATH = [moduleAliasesPath, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
(Module as typeof Module & { _initPaths: () => void })._initPaths();

const SERVER_PORT = 3700;

export default {
    gridUrl: "http://127.0.0.1:4444/",

    baseUrl: `http://host.docker.internal:${SERVER_PORT}/`,

    timeTravel: "off",
    saveHistoryMode: "all",

    screenshotsDir: "test/e2e/screens",

    sets: {
        assertView: {
            files: path.join(__dirname, "tests/test.testplane.js"),
            browsers: ["chrome"],
        },
        timeTravel: {
            files: path.join(__dirname, "tests/time-travel.testplane.js"),
            browsers: ["time-travel-chrome"],
        },
    },

    takeScreenshotOnFails: {
        testFail: true,
        assertViewFail: true,
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
        "time-travel-chrome": {
            timeTravel: "on",
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
        command: `npx --yes serve -p ${SERVER_PORT} --no-request-logging ${path.resolve(__dirname, "static")}`,
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
            path: path.resolve(__dirname, "../../static/basic-report"),
        },
    },
};
