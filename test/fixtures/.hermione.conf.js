"use strict";
module.exports = {
    browsers: {
        chrome: {
            capabilities: {
                browserName: "chrome",
                version: "45",
            },
            sessionsPerBrowser: 5,
        },
    },
    reporters: ["flat", "teamcity"],
};
