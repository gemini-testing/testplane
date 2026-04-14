import type { Rect, Size } from "../../../image";

export const getHorizontalOverflowErrorMessage = (
    readableCaptureAreaDescr: string,
    captureArea: Rect,
    viewport: Size,
): string => {
    return `Could not capture ${readableCaptureAreaDescr} in full, because it is outside of horizontal viewport bounds.

Tried to capture region: left=${captureArea.left}, top=${captureArea.top}, width=${captureArea.width}, height=${captureArea.height}
Viewport size: ${viewport.width}, ${viewport.height}

If this is expected, set "allowViewportOverflow" option of "assertView" command to true.

Otherwise, check that this area:
    - is not larger than browser viewport width
    - is inside viewport (at least horizontally) before performing assertView
Note that you can increase browser window size using "setWindowSize" command or "windowSize" option in the config file.
You may use browser.scroll(x, y) or element.scrollIntoView() to scroll the page before performing assertView.`;
};

export class HorizontalOverflowError extends Error {
    constructor(readableCaptureAreaDescr: string, captureArea: Rect, viewport: Size) {
        const message = getHorizontalOverflowErrorMessage(readableCaptureAreaDescr, captureArea, viewport);

        super(message);

        this.name = this.constructor.name;
    }
}
