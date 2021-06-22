/// <reference types='webdriverio/async' />

declare namespace WebdriverIO {
    interface Browser {
        getMeta(): Browser<Hermione.BrowserMeta>;
        getMeta(key: string): Client<unknown>;

        setMeta(key: string, value: unknown): void;

        extendOptions(opts: { [name: string]: unknown }): void;

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
         *                 screenshotDelay: 600,
         *                 selectorToScroll: '.modal'
         *             }
         *         )
         *});
         * ```
         *
         * @param state state name, should be unique within one test
         * @param selectors DOM-node selector that you need to capture
         * @param opts additional options, currently available:
         * "ignoreElements", "tolerance", "antialiasingTolerance", "allowViewportOverflow", "captureElementFromTop",
         * "compositeImage", "screenshotDelay", "selectorToScroll"
         */
        assertView(state: string, selectors: string | Array<string>, opts?: Hermione.AssertViewOpts): void;
    }
}
