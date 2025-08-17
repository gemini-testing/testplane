import { Size } from "@testplane/webdriverio/build/commands/element";
import { Rect } from "../../../image";

export class VerticalOverflowError extends Error {
    constructor(readableCaptureAreaDescr: string, captureArea: Rect, viewport: Size) {
        const message = `Could not capture ${readableCaptureAreaDescr}, because it is larger than viewport height.

            Tried to capture region: left=${captureArea.left}, top=${captureArea.top}, width=${captureArea.width}, height=${captureArea.height}
            Viewport size: ${viewport.width}, ${viewport.height}

            If you want to capture the entire area, set "compositeImage" option to true in the config file or assertView command options.
            If you want to capture only the visible part and crop the rest, set "compositeImage" option to false and "allowViewportOverflow" to true.`

        super(message);

        this.name = this.constructor.name;
    }
}
