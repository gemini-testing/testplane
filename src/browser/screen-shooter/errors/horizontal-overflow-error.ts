import type { Rect, Size } from "../../../image";

export class HorizontalOverflowError extends Error {
    constructor(readableCaptureAreaDescr: string, captureArea: Rect, viewport: Size) {
        const message = `Could not capture ${readableCaptureAreaDescr}, because it is outside of horizontal viewport bounds.

            Tried to capture region: left=${captureArea.left}, top=${captureArea.top}, width=${captureArea.width}, height=${captureArea.height}
            Viewport size: ${viewport.width}, ${viewport.height}

            Check that this area:
             - is not larger than browser viewport width
             - is inside viewport (at least horizontally) before performing assertView
            Note that you can increase browser window size using "setWindowSize" command or "windowSize" option in the config file.
            You may use browser.scroll(x, y) or element.scrollIntoView() to scroll the page before performing assertView.

            If you want to capture only the visible part and crop the rest, you can use "allowViewportOverflow" option of "assertView" command.`;

        super(message);

        this.name = this.constructor.name;
    }
}
