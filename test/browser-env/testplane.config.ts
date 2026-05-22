/// <reference types="../../build/src/index.d.ts" />

import path from "path";

const shouldUseLocalBrowser = Boolean(process.env.USE_LOCAL_BROWSER);

export default {
    gridUrl: shouldUseLocalBrowser ? "local" : "http://127.0.0.1:4444/",
    baseUrl: shouldUseLocalBrowser ? "http://localhost:5173" : "http://host.docker.internal:5173",
    sessionsPerBrowser: 1,
    testsPerSession: 50,

    screenshotsDir: "test/browser-env/screens",

    takeScreenshotOnFails: {
        testFail: false,
        assertViewFail: false,
    },

    system: {
        workers: 1,
        testRunEnv: ["browser", { viteConfig: path.join(__dirname, "vite.config.ts") }],
    },

    sets: {
        all: {
            files: [path.join(__dirname, "tests/desktop/**/*.testplane.ts")],
            browsers: ["chrome"],
        },
        mobileDpr3: {
            files: [path.join(__dirname, "tests/high-pixel-ratio/**/*.testplane.ts")],
            browsers: ["chrome-mobile-dpr3"],
        },
    },

    headless: !shouldUseLocalBrowser,

    browsers: {
        chrome: {
            windowSize: { width: 1280, height: 1000 },
            desiredCapabilities: {
                browserName: "chrome",
                "goog:chromeOptions": {
                    args: ["no-sandbox", "hide-scrollbars", "disable-dev-shm-usage"],
                    binary: shouldUseLocalBrowser ? undefined : "/usr/bin/chromium",
                },
            },
            waitTimeout: 3000,
        },
        "chrome-mobile-dpr3": {
            desiredCapabilities: {
                browserName: "chrome",
                "goog:chromeOptions": {
                    args: ["no-sandbox", "hide-scrollbars", "disable-dev-shm-usage"],
                    binary: shouldUseLocalBrowser ? undefined : "/usr/bin/chromium",
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
        },
    },

    plugins: {
        "html-reporter/testplane": {
            enabled: true,
            path: "test/browser-env/report",
        },
    },
};
