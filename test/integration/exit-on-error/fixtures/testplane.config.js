module.exports = {
    retry: 5,
    sessionsPerBrowser: 1,
    system: { parallelLimit: 1 },
    plugins: { [require.resolve("./events")]: {} },
    exitOnError: {
        enabled: true,
        filters: [{ name: "quota", filter: /Too Many Requests/i, limit: 1 }],
    },
    browsers: { chrome: { desiredCapabilities: { browserName: "chrome" } } },
};
