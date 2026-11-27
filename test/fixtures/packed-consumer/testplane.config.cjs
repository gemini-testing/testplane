const chrome = {
    headless: true,
    desiredCapabilities: {
        browserName: "chrome",
        browserVersion: process.env.INTEGRATION_BROWSER_VERSION,
        "goog:chromeOptions": { args: ["--no-sandbox", "--disable-dev-shm-usage"] },
    },
};

module.exports = {
    gridUrl: "local",
    browsers: { chrome },
};
