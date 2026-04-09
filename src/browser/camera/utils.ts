import { ImageArea, ScreenshotMode } from ".";

export const isFullPage = (imageArea: ImageArea, viewport: ImageArea, screenshotMode: ScreenshotMode): boolean => {
    switch (screenshotMode) {
        case "fullpage":
            return true;
        case "viewport":
            return false;
        case "auto":
            return imageArea.height > viewport.height || imageArea.width > viewport.width;
    }
};

export const getIntersection = (area1: ImageArea, area2: ImageArea): ImageArea => {
    const left = Math.max(area1.left, area2.left);
    const top = Math.max(area1.top, area2.top);
    const right = Math.min(area1.left + area1.width, area2.left + area2.width);
    const bottom = Math.min(area1.top + area1.height, area2.top + area2.height);

    return {
        left,
        top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
    };
};
