import type { Rect } from "../../../image";

export class OffsetViewportError extends Error {
    constructor(readableCaptureAreaDescr: string, captureArea: Rect, viewport: Rect) {
        const message = `Could not capture ${readableCaptureAreaDescr}, because it is outside of the viewport bounds.

            Tried to capture region: left=${captureArea.left}, top=${captureArea.top}, width=${captureArea.width}, height=${captureArea.height}
            Viewport size: ${viewport.width}, ${viewport.height}

            Check that this area:
             - does not overflow the document
             - does not overflow browser viewport
            Note that you can increase browser window size using "setWindowSize" command or "windowSize" option in the config file.

            If you want to capture only the visible part and crop the rest, you can use "allowViewportOverflow" option of "assertView" command.`;

        super(message);

        this.name = this.constructor.name;
    }
}
