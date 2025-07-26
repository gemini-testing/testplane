import type { ChainablePromiseElement } from "@testplane/webdriverio";
import type { Browser } from "../types";

type MoveToOptions = {
    xOffset?: number;
    yOffset?: number;
};

// As of now, we can't export type of the command function directly. See: https://github.com/webdriverio/webdriverio/issues/12527
export type MoveCursorToCommand = (
    this: WebdriverIO.Element | ChainablePromiseElement<WebdriverIO.Element>,
    options: MoveToOptions,
) => Promise<void>;

const makeMoveCursorToCommand = (session: WebdriverIO.Browser) =>
    async function (this: WebdriverIO.Element, { xOffset = 0, yOffset = 0 }: MoveToOptions = {}): Promise<void> {
        if (!this.isW3C) {
            return this.moveToElement(this.elementId, xOffset, yOffset);
        }

        const { x, y, width, height } = await this.getElementRect(this.elementId);
        const { scrollX, scrollY } = await session.execute(function (this: Window) {
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
export default (browser: Browser): void => {
    const { publicAPI: session } = browser;

    session.addCommand("moveCursorTo", makeMoveCursorToCommand(session), true);
};
