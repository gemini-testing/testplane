import { AssertViewOptsConfig } from "../../config/types.js";

export interface AssertViewOpts extends Partial<AssertViewOptsConfig> {
    /**
     * Maximum allowed difference between colors.
     * Overrides config {@link https://github.com/gemini-testing/hermione#browsers browsers}.{@link https://github.com/gemini-testing/hermione#tolerance tolerance} value.
     *
     * @remarks
     * Indicates maximum allowed CIEDE2000 difference between colors. Used only in non-strict mode.
     * Increasing global default is not recommended, prefer changing tolerance for particular suites or states instead.
     * By default it's 2.3 which should be enough for the most cases.
     *
     * @defaultValue `2.3`
     */
    tolerance?: number;
    /**
     * Minimum difference in brightness (zero by default) between the darkest/lightest pixel (which is adjacent to the antialiasing pixel) and theirs adjacent pixels.
     * Overrides config {@link https://github.com/gemini-testing/hermione#browsers browsers}.{@link https://github.com/gemini-testing/hermione#antialiasingTolerance antialiasingTolerance} value.
     *
     * @remarks
     * Read more about this option in {@link https://github.com/gemini-testing/looks-same#comparing-images-with-ignoring-antialiasing looks-same}
     *
     * @defaultValue `4`
     */
    antialiasingTolerance?: number;
    /**
     * Allows testing of regions which bottom bounds are outside of a viewport height.
     * Overrides config {@link https://github.com/gemini-testing/hermione#browsers browsers}.{@link https://github.com/gemini-testing/hermione#compositeImage compositeImage} value.
     *
     * @remarks
     * In the resulting screenshot the area which fits the viewport bounds will be joined with the area which is outside of the viewport height.
     *
     * @defaultValue `true`
     */
    compositeImage?: boolean;
    /**
     * Allows to specify a delay (in milliseconds) before making any screenshot.
     * Overrides config {@link https://github.com/gemini-testing/hermione#browsers browsers}.{@link https://github.com/gemini-testing/hermione#screenshotDelay screenshotDelay} value.
     *
     * @remarks
     * This is useful when the page has elements which are animated or if you do not want to screen a scrollbar.
     *
     * @defaultValue `0`
     */
    screenshotDelay?: number;
    /**
     * Ability to set DOM-node selector which should be scroll when the captured element does not completely fit on the screen.
     *
     * @remarks
     * Useful when you capture the modal (popup). In this case a duplicate of the modal appears on the screenshot.
     * That happens because we scroll the page using `window` selector, which scroll only the background of the modal, and the modal itself remains in place.
     * Default value is `undefined` (it means scroll relative to `window`). Works only when `compositeImage` is `true` (default).
     *
     * @defaultValue `undefined`
     */
    selectorToScroll?: string;
    /**
     * Ability to disable animations and transitions while making a screenshot
     *
     * @remarks
     * Usefull when you capture screenshot of a page, having animations and transitions.
     * Iframe animations are only disabled when using webdriver protocol.
     *
     * @defaultValue `true`
     */
    disableAnimation?: boolean;
    /**
     * Ability to ignore a small amount of different pixels to classify screenshots as being "identical"
     *
     * @example 5
     * @example '1.5%'
     *
     * @remarks
     * Useful when you encounter a few pixels difference that cannot be eliminated using the tolerance and antialiasingTolerance settings.
     *
     * @note
     * This should be considered a last resort and only used in small number of cases where necessary.
     *
     * @defaultValue `0`
     */
    ignoreDiffPixelCount?: `${number}%` | number;
}

export type AssertViewCommand = (state: string, selectors: string | string[], opts?: AssertViewOpts) => Promise<void>;
export type AssertViewElementCommand = (state: string, opts?: AssertViewOpts) => Promise<void>;
