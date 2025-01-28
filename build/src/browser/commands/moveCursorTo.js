"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const makeMoveCursorToCommand = (session) => async function ({ xOffset = 0, yOffset = 0 } = {}) {
    if (!this.isW3C) {
        return this.moveToElement(this.elementId, xOffset, yOffset);
    }
    const { x, y, width, height } = await this.getElementRect(this.elementId);
    const { scrollX, scrollY } = await session.execute(function () {
        return { scrollX: this.scrollX, scrollY: this.scrollY };
    });
    const newXOffset = Math.floor(x - scrollX + (typeof xOffset === "number" ? xOffset : width / 2));
    const newYOffset = Math.floor(y - scrollY + (typeof yOffset === "number" ? yOffset : height / 2));
    return session
        .action("pointer", { parameters: { pointerType: "mouse" } })
        .move({ x: newXOffset, y: newYOffset })
        .perform();
};
// TODO: remove after next major version
exports.default = (browser) => {
    const { publicAPI: session } = browser;
    session.addCommand("moveCursorTo", makeMoveCursorToCommand(session), true);
};
//# sourceMappingURL=moveCursorTo.js.map