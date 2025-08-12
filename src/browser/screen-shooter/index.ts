import makeDebug from "debug";
import { CompositeImage } from "./composite-image";
import { Image, Point, Rect } from "../../image";
import { PrepareScreenshotResult } from "./types";
import { ExistingBrowser } from "../existing-browser";
import { assertCorrectCaptureAreaBounds } from "./validation";
import { AssertViewOpts } from "../../config/types";
import { WdioBrowser } from "../../types";

const debug = makeDebug("testplane:screenshots:screen-shooter");

interface ScreenShooterOpts extends AssertViewOpts {
    debugId?: string;
}

interface ExtendImageResult {
    hasReachedScrollLimit: boolean;
}

async function getBoundingRect(browser: WdioBrowser, selector: string): Promise<Rect> {
    return browser.execute((selector: string) => {
        const element = document.querySelector(selector);

        if (!element) {
            throw new Error(`Element with selector ${selector} not found`);
        }

        const rect = element.getBoundingClientRect();

        return {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
        };
    }, selector);
}

interface ScrollByParams {
    x: number;
    y: number;
    selectorToScroll?: string;
    // Used to auto-detect scroll parent if selectorToScroll is not provided
    selectorsToCapture: string[];
    debug?: boolean;
}

async function findScrollParentAndScrollBy(browser: WdioBrowser, params: ScrollByParams): Promise<{windowOffset: Point, containerOffset: Point, debugLog?: string}> {
    return browser.execute(function (params) {
        /* eslint-disable no-var */
        /* eslint-disable @typescript-eslint/explicit-function-return-type */
        /* eslint-disable prefer-rest-params */
        // @ts-expect-error Can't use TypeScript in browser-side code
        function createDebugLogger(opts) {
            var log = "";
            if (opts.debug) {
                // @ts-expect-error Can't use TypeScript in browser-side code
                return function (...args) { // eslint-disable-line @typescript-eslint/no-unused-vars
                    for (var i = 0; i < arguments.length; i++) {
                        if (typeof arguments[i] === "object") {
                            try {
                                log += JSON.stringify(arguments[i], null, 2) + "\n";
                            } catch (e) {
                                log += '<failed log message due to an error: ' + e;
                            }
                        } else {
                            log += arguments[i] + "\n";
                        }
                    }
        
                    return log;
                }
            }
        
            return function () { return ""; };
        }
        // @ts-expect-error Can't use TypeScript in browser-side code
        function getScrollOffset(element) {
            if (element === window) {
                return { top: window.pageYOffset, left: window.pageXOffset };
            }
            return { top: element.scrollTop, left: element.scrollLeft };
        }

        // @ts-expect-error Can't use TypeScript in browser-side code
        function getClientSize(element) {
            if (element === window) {
                return { height: window.innerHeight, width: window.innerWidth };
            }
            return { height: element.clientHeight, width: element.clientWidth };
        }

        // @ts-expect-error Can't use TypeScript in browser-side code
        function getScrollSize(element) {
            if (element === window) {
                return { height: window.document.body.scrollHeight, width: window.document.body.scrollWidth };
            }
            return { height: element.scrollHeight, width: element.scrollWidth };
        }

        var logger = createDebugLogger(params);

        // @ts-expect-error Can't use TypeScript in browser-side code
        function getParentNode(node) {
            if (!node) return null;
            if (node instanceof ShadowRoot) return node.host;
            if (node instanceof Element) {
                const root = node.getRootNode();
                return node.parentElement || (root instanceof ShadowRoot ? root.host : null);
            }
            return node.parentNode; // for Text/Comment nodes
        };

        // @ts-expect-error Can't use TypeScript in browser-side code
        function getScrollParent(element) {
            if (element === null) {
                return null;
            }
        
            if (element === window) {
                return window;
            }
        
            var hasOverflow = element.scrollHeight > element.clientHeight;
            if (element instanceof Element) {
                var computedStyleOverflowY = window.getComputedStyle(element).overflowY;
            } else {
                return getScrollParent(getParentNode(element));
            }
            // try {
        
            // } catch (e) {
            //     logger('getScrollParent, failed to get computed style for element', element, e);
            //     logger('element tagName', element.tagName)
            //     return window;
            // }
            var canBeScrolled = computedStyleOverflowY === 'auto' || computedStyleOverflowY === 'scroll' || computedStyleOverflowY === 'overlay';
        
            if (hasOverflow && canBeScrolled) {
                if (element.tagName === 'BODY') {
                    return window;
                }
                return element;
            } else {
                return getScrollParent(getParentNode(element));
            }
        }

        // @ts-expect-error Can't use TypeScript in browser-side code
        function getResultScrollOffsets(element) {
            logger('getting result scroll offsets. element: ', element);
            if (element === window || element.tagName === 'HTML') {
                logger('element is window. res: ', { top: window.pageYOffset, left: window.pageXOffset });
                return {
                    windowOffset: { top: window.pageYOffset, left: window.pageXOffset },
                    containerOffset: { top: 0, left: 0 },
                    debugLog: logger()
                };
            }
            logger('element is NOT window. returning combo of window and container: ', { windowOffset: { top: window.pageYOffset, left: window.pageXOffset }, containerOffset: { top: element.scrollTop, left: element.scrollLeft } });
            return {
                windowOffset: { top: window.pageYOffset, left: window.pageXOffset },
                containerOffset: { top: element.scrollTop, left: element.scrollLeft },
                debugLog: logger()
            };
        }

        var elementToScroll, targetScrollOffset, originalScrollOffset, iterations;

        // Determining element to scroll
        if (params.selectorToScroll) {
            elementToScroll = document.querySelector(params.selectorToScroll);

            if (!elementToScroll) {
                throw new Error(
                    "Scroll screenshot failed with: " +
                        'Could not find element with css selector specified in "selectorToScroll" option: ' +
                        params.selectorToScroll,
                );
            }
        } else {
            // Try to determine it automatically or fallback to window
            var scrollParents = params.selectorsToCapture.map(selector => getScrollParent(document.querySelector(selector)));
            logger('scroll parents:', scrollParents);
            if (scrollParents[0] !== null && scrollParents.every(element => scrollParents[0] === element)) {
                elementToScroll = scrollParents[0];
                logger('Successfully determined scroll element!');
                // @ts-expect-error can't write typescript code in browser side code
                logger(elementToScroll === window ? 'window' : (elementToScroll.classList && elementToScroll.classList.toString()));
            } else {
                elementToScroll = window;
                logger('falling back to window.')
            }
        }

        // Performing scroll
        originalScrollOffset = getScrollOffset(elementToScroll);
        logger('original scroll offset:', originalScrollOffset)
        targetScrollOffset = { top: originalScrollOffset.top + params.y, left: originalScrollOffset.left + params.x };

        logger('performing scroll in element to coords:', elementToScroll, targetScrollOffset.top, targetScrollOffset.left)
        elementToScroll.scrollTo(targetScrollOffset.left, targetScrollOffset.top);
        // window.document.body.scrollTo()

        // Wait for scroll to happen
        iterations = 0;
        var resultScrollOffset = getScrollOffset(elementToScroll),
            clientSize = getClientSize(elementToScroll),
            scrollSize = getScrollSize(elementToScroll);
        const reachedVerticalScrollLimit = params.y === 0 || (resultScrollOffset.top + clientSize.height >= scrollSize.height);
        const reachedHorizontalScrollLimit = params.x === 0 || (resultScrollOffset.left + clientSize.width >= scrollSize.width);

        while (resultScrollOffset.left === originalScrollOffset.left && resultScrollOffset.top === originalScrollOffset.top && !(reachedVerticalScrollLimit && reachedHorizontalScrollLimit)) {
            if (iterations++ > 100000) {
                return getResultScrollOffsets(elementToScroll);
            }
            resultScrollOffset = getScrollOffset(elementToScroll);
        }

        return getResultScrollOffsets(elementToScroll);
        /* eslint-enable @typescript-eslint/explicit-function-return-type */
        /* eslint-enable prefer-rest-params */
        /* eslint-enable no-var */
    }, params);
}

export class ScreenShooter {
    private _browser: ExistingBrowser;
    private _lastVerticalScrollOffset: number = -1;
    private _selectorsToCapture: string[] = [];

    static create(browser: ExistingBrowser): ScreenShooter {
        return new this(browser);
    }

    constructor(browser: ExistingBrowser) {
        this._browser = browser;
    }

    async capture(selectorOrSectorsArray: string | string[], opts: ScreenShooterOpts = {}): Promise<{ image: Image, meta: PrepareScreenshotResult }> {
        const selectors = ([] as string[]).concat(selectorOrSectorsArray);
        this._selectorsToCapture = selectors;

        const browserPrepareScreenshotDebug = makeDebug("testplane:screenshots:browser:prepareScreenshot");

        const page = await this._browser.prepareScreenshot(selectors, {
            ignoreSelectors: ([] as string[]).concat(opts.ignoreElements ?? []),
            allowViewportOverflow: opts.allowViewportOverflow,
            captureElementFromTop: opts.captureElementFromTop,
            selectorToScroll: opts.selectorToScroll,
            disableAnimation: opts.disableAnimation,
            debug: browserPrepareScreenshotDebug.enabled,
        });

        // await this._browser.publicAPI.pause(200000);

        browserPrepareScreenshotDebug(`[${opts.debugId}] browser logs during prepareScreenshot call:\n${page.debugLog}`);
        delete page.debugLog;

        assertCorrectCaptureAreaBounds(JSON.stringify(selectors), page.viewport, page.captureArea, opts);

        debug(`[${opts.debugId}] prepareScreenshot result: %O`, page);

        const viewportImage = await this._browser.captureViewportImage(page, opts.screenshotDelay);
        const image = CompositeImage.create(page.captureArea, page.safeArea, page.ignoreAreas);
        await image.registerViewportImageAtOffset(viewportImage, { top: page.containerScrollY, left: page.containerScrollX }, { top: page.windowScrollY, left: page.windowScrollX });

        await this._captureOverflowingAreaIfNeeded(image, page, opts);

        return {
            image: await image.render(),
            meta: page,
        };
    }

    private async _captureOverflowingAreaIfNeeded(
        image: CompositeImage,
        page: PrepareScreenshotResult,
        opts: ScreenShooterOpts,
    ): Promise<void> {
        const COMPOSITE_ITERATIONS_LIMIT = 25;
        let iterations = 0;
        let hasReachedScrollLimit = false;

        while (opts.compositeImage && image.hasNotCapturedArea() && iterations < COMPOSITE_ITERATIONS_LIMIT && !hasReachedScrollLimit) {
            const result = await this._scrollOnceAndExtendImage(image, page, opts);
            hasReachedScrollLimit = result.hasReachedScrollLimit;

            iterations++;
        }
    }

    private async _scrollOnceAndExtendImage(image: CompositeImage, page: PrepareScreenshotResult, opts: ScreenShooterOpts): Promise<ExtendImageResult> {
        const nextNotCapturedArea = image.getNextNotCapturedArea() as Rect;

        const boundingRectBeforeScroll = await getBoundingRect(this._browser.publicAPI, this._selectorsToCapture[0]).catch(() => null);

        debug('boundingRectBeforeScroll: %O', boundingRectBeforeScroll);

        const physicalScrollHeight = Math.max(Math.min(nextNotCapturedArea.height, page.safeArea.height), 2 * page.pixelRatio);
        const logicalScrollHeight = Math.ceil(physicalScrollHeight / page.pixelRatio) - 1;

        const browserScrollByDebug = makeDebug("testplane:screenshots:browser:scrollBy");
        const {windowOffset: logicalWindowOffset, containerOffset: logicalContainerOffset, debugLog} = await findScrollParentAndScrollBy(this._browser.publicAPI, {
            x: 0,
            y: logicalScrollHeight,
            selectorToScroll: opts.selectorToScroll,
            selectorsToCapture: this._selectorsToCapture,
            debug: browserScrollByDebug.enabled
        });
        browserScrollByDebug(debugLog);

        const windowOffset = {top: logicalWindowOffset.top * page.pixelRatio, left: logicalWindowOffset.left * page.pixelRatio};
        const containerOffset = {top: logicalContainerOffset.top * page.pixelRatio, left: logicalContainerOffset.left * page.pixelRatio};
        // await this._browser.publicAPI.pause(200000);

        const boundingRectAfterScroll = await getBoundingRect(this._browser.publicAPI, this._selectorsToCapture[0]).catch(() => null);

        debug('boundingRectAfterScroll: %O', boundingRectAfterScroll);
        debug('are bounding rects top values equal: %O', boundingRectBeforeScroll?.top === boundingRectAfterScroll?.top);

        // So, here's we just check that this scroll has worked. We do that by checking if target area client bounding rect has changed.
        // If it didn't, it means that we either reached scroll limit or using wrong selector to scroll altogether.
        if (boundingRectBeforeScroll && boundingRectAfterScroll && boundingRectBeforeScroll.top === boundingRectAfterScroll.top) {
            if (opts.allowViewportOverflow) {
                return { hasReachedScrollLimit: true }; // TODO give this param a better name
            } else {
                console.warn('Most likely you are using wrong selector to scroll. Make sure it\'s possible to capture the whole area!'); // TODO
                // throw new Error('Most likely you are using wrong selector to scroll. Make sure it\'s possible to capture the whole area using '); // TODO
                return { hasReachedScrollLimit: true };
            }
        }

        // const containerScrollOffset = opts.selectorToScroll ? {
        //     top: logicalScrollOffset.top * page.pixelRatio,
        //     left: logicalScrollOffset.left * page.pixelRatio,
        // } : { top: 0, left: 0 };
        // const windowScrollY = opts.selectorToScroll ? page.windowScrollY : logicalScrollOffset.top * page.pixelRatio;
        // const windowScrollX = opts.selectorToScroll ? page.windowScrollX : logicalScrollOffset.left * page.pixelRatio;

        if (this._lastVerticalScrollOffset === windowOffset.top + containerOffset.top) {
            debug('Reached scroll limit!');

            // TODO: throw an error if allowViewportOverflow is false and some not captured area is left

            return { hasReachedScrollLimit: true };
        }

        debug('Scrolled by %dpx to extend image.\n  nextNotCapturedArea was: %O\n  current container scroll offset: %O\n  current window scroll offset: %O', logicalScrollHeight, nextNotCapturedArea, containerOffset, windowOffset);

        const newImage = await this._browser.captureViewportImage(page, opts.screenshotDelay);

        await image.registerViewportImageAtOffset(newImage, containerOffset, windowOffset);

        this._lastVerticalScrollOffset = windowOffset.top + containerOffset.top;

        return { hasReachedScrollLimit: false };
    }
}
