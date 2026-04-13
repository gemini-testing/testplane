import { BrowserSideErrorCode } from "@isomorphic";

export class OutsideOfViewportError extends Error {
    errorCode: BrowserSideErrorCode;
    debugLog?: string;

    constructor(debugLog?: string) {
        super(
            "Can not capture element, because it is completely outside of viewport with no intersection. " +
                'Try to set "captureElementFromTop=true" to scroll to it before capture.'
        );
        this.name = "OutsideOfViewportError";
        this.errorCode = BrowserSideErrorCode.OUTSIDE_OF_VIEWPORT;
        this.debugLog = debugLog;
    }
}
