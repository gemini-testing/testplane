import { ImageArea, PageMeta, ScreenshotMode } from ".";

export const isFullPage = (imageArea: ImageArea, page: PageMeta, screenshotMode: ScreenshotMode): boolean => {
    switch (screenshotMode) {
        case "fullpage":
            return true;
        case "viewport":
            return false;
        case "auto":
            return compareDimensions(imageArea, page);
    }
};

function compareDimensions(imageArea: ImageArea, page: PageMeta): boolean {
    return imageArea.height >= page.documentHeight && imageArea.width >= page.documentWidth;
}
