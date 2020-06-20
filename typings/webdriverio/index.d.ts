/// <reference types='webdriverio' />

declare namespace WebdriverIO {
    export interface Client<T> {
        getMeta(): Client<Hermione.BrowserMeta>;
        getMeta(key: string): Client<unknown>;

        setMeta(key: string, value: unknown): Client<T>;

        extendOptions(opts: { [name: string]: unknown }): Client<T>;

        /**
         * Takes a screenshot of the passed selector and compares the received screenshot with the reference.
         *
         * @remarks
         * For more details, see {@link https://github.com/gemini-testing/hermione#assertview documentation}.
         *
         * @example
         * ```ts
         *
         * it('some test', function() {
         *     return this.browser
         *         .url('some/url')
         *         .assertView(
         *             'plain',
         *             '.button',
         *             {
         *                 ignoreElements: ['.link'],
         *                 tolerance: 2.3,
         *                 antialiasingTolerance: 4,
         *                 allowViewportOverflow: true,
         *                 captureElementFromTop: true,
         *                 compositeImage: true,
         *                 screenshotDelay: 600
         *             }
         *         )
         *});
         * ```
         *
         * @param state state name, should be unique within one test
         * @param selectors DOM-node selector that you need to capture
         * @param opts additional options, currently available:
         * "ignoreElements", "tolerance", "antialiasingTolerance", "allowViewportOverflow", "captureElementFromTop", "compositeImage", "screenshotDelay"
         */
        assertView(state: string, selectors: string | Array<string>, opts?: Hermione.AssertViewOpts): Client<T>;
    }
}
