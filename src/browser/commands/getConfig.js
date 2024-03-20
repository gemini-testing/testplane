"use strict";

module.exports.default = browser => {
    const { publicAPI: session, config } = browser;
    session.addCommand("getConfig", () => config);
};
