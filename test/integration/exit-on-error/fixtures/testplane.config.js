const patterns = [{ name: "quota", pattern: /Too Many Requests/i }];
const failureOptions = {
    numeric: { maxFailures: 2 },
    filtered: { maxFailures: { limit: 2, patterns } },
    immediate: { maxFailures: { limit: 20, patterns }, patternsOnReject: patterns },
};

module.exports = {
    retry: 5,
    sessionsPerBrowser: 1,
    system: {
        parallelLimit: 1,
        ...failureOptions[process.env.TESTPLANE_FAILURE_MODE || "filtered"],
    },
    plugins: { [require.resolve("./events")]: {} },
    browsers: { chrome: { desiredCapabilities: { browserName: "chrome" } } },
};
