"use strict";

module.exports = {
    gridUrl: "local",
    headless: "new",
    sets: {
        default: { files: ["tests/**/*.test.[jt]s"] },
    },
    browsers: {
        chrome: {
            desiredCapabilities: {
                browserName: "chrome",
                "goog:chromeOptions": {
                    args: ["--no-sandbox", "--disable-dev-shm-usage"],
                },
            },
        },
    },
    system: {
        workers: 1,
        mochaOpts: {
            timeout: 60000,
        },
    },
};
