/// <reference types='webdriverio/async' />
/// <reference types="expect-webdriverio/types/standalone"/>

declare namespace WebdriverIO {
    interface Browser {
        getMeta(): Promise<Hermione.BrowserMeta>;
        getMeta(key: string): Promise<unknown>;

        setMeta(key: string, value: unknown): Promise<void>;

        extendOptions(opts: { [name: string]: unknown }): Promise<void>;

        /**
         * Takes a screenshot of the passed selector and compares the received screenshot with the reference.
         *
         * @remarks
         * For more details, see {@link https://github.com/gemini-testing/hermione#assertview documentation}.
         *
         * @example
         * ```ts
         *
         * it('some test', async function() {
         *     await this.browser.url('some/url');
         *     await this.browser.assertView('plain', '.button', {
         *         ignoreElements: ['.link'],
         *         tolerance: 2.3,
         *         antialiasingTolerance: 4,
         *         allowViewportOverflow: true,
         *         captureElementFromTop: true,
         *         compositeImage: true,
         *         screenshotDelay: 600,
         *         selectorToScroll: '.modal'
         *     });
         *});
         * ```
         *
         * @param state state name, should be unique within one test
         * @param selectors DOM-node selector that you need to capture
         * @param opts additional options, currently available:
         * "ignoreElements", "tolerance", "antialiasingTolerance", "allowViewportOverflow", "captureElementFromTop",
         * "compositeImage", "screenshotDelay", "selectorToScroll"
         */
        assertView(state: string, selectors: string | Array<string>, opts?: Hermione.AssertViewOpts): Promise<void>;

        /**
         * Command that allows to add human-readable description for commands in history
         *
         * @remarks
         * For more details, see {@link https://github.com/gemini-testing/hermione#runstep documentation}
         *
         * @example
         * ```ts
         * it('some test', async function () {
         *     await this.browser.runStep('step name', async () => {
         *         await this.browser.url('some/url');
         *         ...
         *     });
         * })
         * ```
         *
         * @param stepName step name
         * @param stepCb step callback
         * @returns {Promise<any>} value, returned by `stepCb`
         */
        runStep(stepName: string, stepCb: () => Promise<any> | any): Promise<any>;
    }

    interface Element {
        /**
         * Takes a screenshot of the element and compares the received screenshot with the reference.
         *
         * @remarks
         * For more details, see {@link https://github.com/gemini-testing/hermione#assertview documentation}.
         *
         * @example
         * ```ts
         *
         * it('some test', async function() {
         *     await this.browser.url('some/url');
         *     const button = await this.browser.$('.button');
         *     await button.assertView('plain', {
         *         ignoreElements: ['.link'],
         *         tolerance: 2.3,
         *         antialiasingTolerance: 4,
         *         allowViewportOverflow: true,
         *         captureElementFromTop: true,
         *         compositeImage: true,
         *         screenshotDelay: 600,
         *         selectorToScroll: '.modal'
         *     });
         *});
         * ```
         *
         * @param state state name, should be unique within one test
         * @param opts additional options, currently available:
         * "ignoreElements", "tolerance", "antialiasingTolerance", "allowViewportOverflow", "captureElementFromTop",
         * "compositeImage", "screenshotDelay", "selectorToScroll"
         */
        assertView(state: string, opts?: Hermione.AssertViewOpts): Promise<void>;
    }
}

declare const expect: ExpectWebdriverIO.Expect;
