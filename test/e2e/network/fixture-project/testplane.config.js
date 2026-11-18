"use strict";

module.exports = {
    gridUrl: "local",
    headless: true,
    baseUrl: process.env.NETWORK_E2E_URL,
    timeTravel: {
        mode: "on",
        ...(process.env.NETWORK_E2E_ENABLED === "true" && { network: true }),
    },
    sets: {
        default: { files: ["request.test.js"] },
    },
    browsers: {
        chrome: {
            desiredCapabilities: {
                browserName: "chrome",
                "goog:chromeOptions": { args: ["--no-sandbox", "--disable-dev-shm-usage"] },
            },
        },
        firefox: {
            desiredCapabilities: { browserName: "firefox" },
        },
    },
    plugins: {
        [require.resolve("./collect-events")]: {},
    },
    system: { workers: 1 },
};
