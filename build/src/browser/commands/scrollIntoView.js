"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// TODO: remove after fix https://github.com/webdriverio/webdriverio/issues/9620
exports.default = (browser) => {
    const { publicAPI: session } = browser;
    session.overwriteCommand("scrollIntoView", async function (_origScrollIntoView, options = { block: "start", inline: "nearest" }) {
        await session.execute(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        function f(elem, options) {
            return elem.scrollIntoView(options);
        }, this, options);
    }, true);
};
//# sourceMappingURL=scrollIntoView.js.map