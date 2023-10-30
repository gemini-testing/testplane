"use strict";
module.exports = browser => {
    const { publicAPI: session, config } = browser;
    session.addCommand("getConfig", () => config);
};
//# sourceMappingURL=getConfig.js.map