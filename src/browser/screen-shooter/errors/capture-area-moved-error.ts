import { Rect, prettyRect } from "../../isomorphic";

export class CaptureAreaMovedError extends Error {
    retriable: boolean;

    constructor(
        selectorsToCapture: string[],
        lastCaptureAreas: Rect<"viewport", "device">[],
        newCaptureAreas: Rect<"viewport", "device">[],
    ) {
        const message = `The capture area moved unexpectedly during scrolling while capturing long screenshot. What happened:
- you requested to capture the following selectors: ${selectorsToCapture.join("; ")}
- last capture areas: ${lastCaptureAreas.map(prettyRect).join(", ")}
- new capture areas: ${newCaptureAreas.map(prettyRect).join(", ")}
- we tried multiple times, but still couldn't capture the whole area

What you can do:
- Check that the page is stable before taking the screenshot
- Check that there's no content that loads dynamically
`;
        super(message);
        this.name = "CaptureAreaMovedError";
        this.retriable = true;
    }
}
