describe("assertView", () => {
    it('should take a screenshot of a block that is slightly not in viewport with captureElementFromTop', async ({browser}) => {
        await browser.url('slightly-not-in-viewport.html');

        await browser.assertView('test-block', '[data-testid=test-block]', {captureElementFromTop: true});
    });

    it('should take a screenshot of a block that is slightly not in viewport without captureElementFromTop', async ({browser}) => {
        await browser.url('slightly-not-in-viewport.html');

        await browser.assertView('test-block', '[data-testid=test-block]', {captureElementFromTop: false});
    });

    it('should take a screenshot of a very long block with captureElementFromTop', async ({browser}) => {
        await browser.url('very-long-block.html');

        await browser.assertView('test-block', '[data-testid=test-block]', {captureElementFromTop: true});
    });

    it('should take a screenshot of a very long block without captureElementFromTop', async ({browser}) => {
        await browser.url('very-long-block.html');

        await browser.assertView('test-block', '[data-testid=test-block]', {captureElementFromTop: false});
    });

    it('should take a screenshot of a very long block with sticky elements with captureElementFromTop', async ({browser}) => {
        await browser.url('very-long-block-with-sticky-elements.html');

        await browser.assertView('test-block', '[data-testid=test-block]', {captureElementFromTop: true});
    });

    it('should take a screenshot of a very long block with sticky elements without captureElementFromTop', async ({browser}) => {
        await browser.url('very-long-block-with-sticky-elements.html');

        await browser.assertView('test-block', '[data-testid=test-block]', {captureElementFromTop: false});
    });

    it('should take a screenshot of a long block inside a scrollable container with captureElementFromTop', async ({browser}) => {
        await browser.url('long-block-inside-scrollable-container.html');

        await browser.assertView('test-block', '[data-testid=test-block]', {selectorToScroll: '.scrollable-container', captureElementFromTop: true});
    });

    it('should take a screenshot of a long block inside a scrollable container that is not in view at page load', async ({browser}) => {
        await browser.url('long-block-inside-scrollable-container-not-in-view.html');

        await browser.assertView('test-block', '[data-testid=test-block]', {selectorToScroll: '.scrollable-container', captureElementFromTop: true});
    });

    it('should work with ignoreAreas', async ({browser}) => {
        await browser.url('simple-ignore-areas-test.html');

        await browser.assertView('test-block', '[data-testid=test-card]', {ignoreElements: ['.to-be-ignored']});
    });

    it('should work with ignoreAreas with scrollable container', async ({browser}) => {
        await browser.url('long-block-inside-scrollable-container-not-in-view-ignore-areas.html');

        await browser.assertView('test-block', '[data-testid=test-block]', {selectorToScroll: '.scrollable-container', captureElementFromTop: true, ignoreElements: ['.to-be-ignored-1', '.to-be-ignored-2', '.to-be-ignored-3']});
    });

    it('should work with a simple card that is far below the viewport', async ({browser}) => {
        await browser.url('card-far-below-viewport.html');

        await browser.assertView('test-block', '[data-testid=test-card]', {captureElementFromTop: true});
    });

    it('should work with a bottom drawer with a long list', async ({browser}) => {
        await browser.url('bottom-drawer-with-long-list.html');

        await browser.assertView('test-block', '[data-testid=list-container]', {selectorToScroll: '[data-testid=drawer-content]'});
    });

    it('should work with a modal window with fixed elements underneath', async ({browser}) => {
        await browser.url('modal-window-playground.html');

        await browser.assertView('test-block', '[data-testid=modal-window]', {captureElementFromTop: true});
    });

    it('should work with a fixed element that is out of viewport', async ({browser}) => {
        await browser.url('fixed-element-out-of-viewport.html');

        await browser.assertView('test-block', '[data-testid=test-block]', {captureElementFromTop: true, allowViewportOverflow: true});
    });

    it('should handle a case when no selector to scroll is provided', async ({browser}) => {
        await browser.url('scrollable-modal-playground.html');

        await browser.$('[data-testid=open-modal-btn]').click();

        await browser.assertView('test-block', '[data-testid=modal-content-items]');
    });

    it('should work fine when it\'s impossible to adjust safe area because the block would still interfere', async ({browser}) => {
        await browser.url('impossible-safe-area.html');

        await browser.assertView('test-block', '[data-testid=test-block]');
    });

    it('should work fine when it\'s impossible to adjust safe area because the blocks would still slightly interfere', async ({browser}) => {
        await browser.url('slightly-overlapping-impossible-safe-area.html');

        await browser.assertView('test-block', '[data-testid=test-block]');
    });

    it('should work fine with weirdly positioned ignore areas', async ({browser}) => {
        await browser.url('impossible-ignore-elements.html');

        await browser.assertView('test-block', '[data-testid=test-block]', {ignoreElements: ['.ignore-block']});
    });

    it('should work fine when specified ignore selectors don\'t exist', async ({browser}) => {
        await browser.url('slightly-not-in-viewport.html');

        await browser.assertView('test-block', '[data-testid=test-block]', {ignoreElements: ['.some-random-selector', 'another-one']});
    });

    it('should work fine with when overflowing parent with overflow visible', async ({browser}) => {
        await browser.url('nested-overflow-visible-diagonal-block.html');

        await browser.assertView('test-block', '[data-testid=test-block]');
    });

    it('should work fine with ignore areas of blocks with fractional coordinates', async ({browser}) => {
        await browser.url('fractional-boxes-inside-test-block.html');

        await browser.assertView('test-block', '[data-testid=test-block]', {ignoreElements: ['.box']});
    });

    it('should work fine when user manually scrolled to some point before assertView', async ({browser}) => {
        await browser.url('card-far-below-viewport.html');

        await browser.execute(() => {
            window.scrollTo(0, 1000);
        });

        await browser.assertView('test-block', '[data-testid=test-card]');
    });

    it('should provide best-effort support when trying to capture drawer and scrollable content inside it', async ({browser}) => {
        await browser.url('bottom-drawer-with-long-list.html');

        await browser.assertView('test-block', ['[data-testid=bottom-drawer]', '[data-testid=list-container]', '.button-wrapper'], {selectorToScroll: '[data-testid=drawer-content]'});
    });

    it('should correctly capture elements that have sticky content inside', async ({browser}) => {
        await browser.url('sticky-element-inside-capture-area.html');

        await browser.assertView('test-block', '[data-testid=capture-element]');
    });
});
