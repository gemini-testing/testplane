import {ScreenshotMode} from './constants';

import type Image from '../../image';
import type {Page} from '../../types/page';

export function isFullPage(image: Image, page: Page, screenshotMode: ScreenshotMode): boolean {
    switch (screenshotMode) {
        case ScreenshotMode.fullpage: return true;
        case ScreenshotMode.viewport: return false;
        case ScreenshotMode.auto: return compareDimensions(image, page);
    }
}

/**
 * @param image - PngImg wrapper
 * @param page - capture meta information object
 */
function compareDimensions(image: Image, page: Page): boolean {
    const pixelRatio = page.pixelRatio;
    const documentWidth = page.documentWidth * pixelRatio;
    const documentHeight = page.documentHeight * pixelRatio;
    const imageSize = image.getSize();

    return imageSize.height >= documentHeight && imageSize.width >= documentWidth;
}
