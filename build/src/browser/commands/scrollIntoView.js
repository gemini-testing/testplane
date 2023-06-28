"use strict";
module.exports = async (browser) => {
    const { publicAPI: session } = browser;
    session.overwriteCommand("scrollIntoView", async function (_origScrollIntoView, options = { block: "start", inline: "nearest" }) {
        await session.execute((elem, options) => elem.scrollIntoView(options), this, options);
    }, true);
};
//# sourceMappingURL=scrollIntoView.js.map