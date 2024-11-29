const mkChrome = (browserVersion: string): Record<string, unknown> => ({
    desiredCapabilities: {
        browserName: "chrome",
        browserVersion,
        ...(Number(browserVersion.split(".")[0]) <= 90 ? { "goog:chromeOptions": { args: ["--no-sandbox"] } } : {}),
    },
});

const mkFirefox = (browserVersion: string): Record<string, unknown> => ({
    desiredCapabilities: {
        browserName: "firefox",
        browserVersion,
    },
});

export default {
    gridUrl: "local",
    baseUrl: "http://localhost",
    pageLoadTimeout: 0,
    httpTimeout: 60000,
    testTimeout: 90000,
    resetCursor: false,
    automationProtocol: "webdriver",
    headless: true,
    system: {
        debug: false,
        parallelLimit: 1,
    },
    sets: {
        chrome: {
            files: ["testplane-tests/**/*.testplane.(t|j)s"],
            browsers: ["chrome75", "chrome80", "chrome90", "chrome100", "chrome110", "chrome120", "chrome130"],
        },
        firefox: {
            files: ["testplane-tests/**/*.testplane.(t|j)s"],
            browsers: [
                "firefox60",
                "firefox70",
                "firefox80",
                "firefox90",
                "firefox100",
                "firefox110",
                "firefox120",
                "firefox130",
            ],
        },
    },
    browsers: {
        chrome75: mkChrome("75.0"),
        chrome80: mkChrome("80.0"),
        chrome90: mkChrome("90.0"),
        chrome100: mkChrome("100.0"),
        chrome110: mkChrome("110.0"),
        chrome120: mkChrome("120.0"),
        chrome130: mkChrome("130.0"),
        chrome: mkChrome("123.0"),
        firefox60: mkFirefox("60.0"),
        firefox70: mkFirefox("70.0"),
        firefox80: mkFirefox("80.0"),
        firefox90: mkFirefox("90.0"),
        firefox100: mkFirefox("100.0"),
        firefox110: mkFirefox("110.0"),
        firefox120: mkFirefox("120.0"),
        firefox130: mkFirefox("120.0"),
    },
};
