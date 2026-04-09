/* global document, window */

describe("assertView", () => {
    it("should take a screenshot of a block that is slightly not in viewport with captureElementFromTop", async ({
        browser,
    }) => {
        await browser.url("slightly-not-in-viewport.html");

        await browser.assertView("test-block", "[data-testid=test-block]", { captureElementFromTop: true });
    });

    it("should take a screenshot of a block that is slightly not in viewport without captureElementFromTop", async ({
        browser,
    }) => {
        await browser.url("slightly-not-in-viewport.html");

        await browser.assertView("test-block", "[data-testid=test-block]", { captureElementFromTop: false });
    });

    it("should take a screenshot of a very long block with captureElementFromTop", async ({ browser }) => {
        await browser.url("very-long-block.html");

        await browser.assertView("test-block", "[data-testid=test-block]", { captureElementFromTop: true });
    });

    it("should take a screenshot of a very long block without captureElementFromTop", async ({ browser }) => {
        await browser.url("very-long-block.html");

        await browser.assertView("test-block", "[data-testid=test-block]", { captureElementFromTop: false });
    });

    it("should take a screenshot of a very long block with sticky elements with captureElementFromTop", async ({
        browser,
    }) => {
        await browser.url("very-long-block-with-sticky-elements.html");

        await browser.assertView("test-block", "[data-testid=test-block]", { captureElementFromTop: true });
    });

    it("should take a screenshot of a very long block with sticky elements without captureElementFromTop", async ({
        browser,
    }) => {
        await browser.url("very-long-block-with-sticky-elements.html");

        await browser.assertView("test-block", "[data-testid=test-block]", { captureElementFromTop: false });
    });

    it("should take a screenshot of a long block inside a scrollable container with captureElementFromTop", async ({
        browser,
    }) => {
        await browser.url("long-block-inside-scrollable-container.html");

        await browser.assertView("test-block", "[data-testid=test-block]", {
            selectorToScroll: ".scrollable-container",
            captureElementFromTop: true,
        });
    });

    it("should take a screenshot of a long block inside a scrollable container that is not in view at page load", async ({
        browser,
    }) => {
        await browser.url("long-block-inside-scrollable-container-not-in-view.html");

        await browser.assertView("test-block", "[data-testid=test-block]", {
            selectorToScroll: ".scrollable-container",
            captureElementFromTop: true,
        });
    });

    it("should work with ignoreAreas", async ({ browser }) => {
        await browser.url("simple-ignore-areas-test.html");

        await browser.assertView("test-block", "[data-testid=test-card]", { ignoreElements: [".to-be-ignored"] });
    });

    it("should work with ignoreAreas with scrollable container", async ({ browser }) => {
        await browser.url("long-block-inside-scrollable-container-not-in-view-ignore-areas.html");

        await browser.assertView("test-block", "[data-testid=test-block]", {
            selectorToScroll: ".scrollable-container",
            captureElementFromTop: true,
            ignoreElements: [".to-be-ignored-1", ".to-be-ignored-2", ".to-be-ignored-3"],
        });
    });

    it("should work with a simple card that is far below the viewport", async ({ browser }) => {
        await browser.url("card-far-below-viewport.html");

        await browser.assertView("test-block", "[data-testid=test-card]", { captureElementFromTop: true });
    });

    it("should work with a bottom drawer with a long list", async ({ browser }) => {
        await browser.url("bottom-drawer-with-long-list.html");

        await browser.assertView("test-block", "[data-testid=list-container]", {
            selectorToScroll: "[data-testid=drawer-content]",
        });
    });

    it("should work with a modal window with fixed elements underneath", async ({ browser }) => {
        await browser.url("modal-window-playground.html");

        await browser.assertView("test-block", "[data-testid=modal-window]", { captureElementFromTop: true });
    });

    it("should work with a fixed element that is out of viewport", async ({ browser }) => {
        await browser.url("fixed-element-out-of-viewport.html");

        await browser.assertView("test-block", "[data-testid=test-block]", {
            captureElementFromTop: true,
            allowViewportOverflow: true,
        });
    });

    it("should handle a case when no selector to scroll is provided", async ({ browser }) => {
        await browser.url("scrollable-modal-playground.html");

        await browser.$("[data-testid=open-modal-btn]").click();

        await browser.assertView("test-block", "[data-testid=modal-content-items]");
    });

    it("should work fine when it's impossible to adjust safe area because the block would still interfere", async ({
        browser,
    }) => {
        await browser.url("impossible-safe-area.html");

        await browser.assertView("test-block", "[data-testid=test-block]");
    });

    it("should work fine when it's impossible to adjust safe area because the blocks would still slightly interfere", async ({
        browser,
    }) => {
        await browser.url("slightly-overlapping-impossible-safe-area.html");

        await browser.assertView("test-block", "[data-testid=test-block]");
    });

    it("should work fine with weirdly positioned ignore areas", async ({ browser }) => {
        await browser.url("impossible-ignore-elements.html");

        await browser.assertView("test-block", "[data-testid=test-block]", { ignoreElements: [".ignore-block"] });
    });

    it("should work fine when specified ignore selectors don't exist", async ({ browser }) => {
        await browser.url("slightly-not-in-viewport.html");

        await browser.assertView("test-block", "[data-testid=test-block]", {
            ignoreElements: [".some-random-selector", "another-one"],
        });
    });

    it("should work fine with when overflowing parent with overflow visible", async ({ browser }) => {
        await browser.url("nested-overflow-visible-diagonal-block.html");

        await browser.assertView("test-block", "[data-testid=test-block]");
    });

    it("should work fine with ignore areas of blocks with fractional coordinates", async ({ browser }) => {
        await browser.url("fractional-boxes-inside-test-block.html");

        await browser.assertView("test-block", "[data-testid=test-block]", { ignoreElements: [".box"] });
    });

    it("should work fine when user manually scrolled to some point before assertView", async ({ browser }) => {
        await browser.url("card-far-below-viewport.html");

        await browser.execute(() => {
            // eslint-disable-next-line no-undef
            window.scrollTo(0, 1000);
        });

        await browser.assertView("test-block", "[data-testid=test-card]");
    });

    it("should provide best-effort support when trying to capture drawer and scrollable content inside it", async ({
        browser,
    }) => {
        await browser.url("bottom-drawer-with-long-list.html");

        await browser.assertView(
            "test-block",
            ["[data-testid=bottom-drawer]", "[data-testid=list-container]", ".button-wrapper"],
            { selectorToScroll: "[data-testid=drawer-content]" },
        );
    });

    it("should correctly capture elements that have sticky content inside", async ({ browser }) => {
        await browser.url("sticky-element-inside-capture-area.html");

        await browser.assertView("test-block", "[data-testid=capture-element]");
    });

    describe("allowViewportOverflow", () => {
        it("should still try to scroll when allowViewportOverflow is true", async ({ browser }) => {
            await browser.url("long-block.html");

            await browser.assertView("test-block", "[data-testid=test-block]", { allowViewportOverflow: true });
        });
    });

    describe("disableHover", () => {
        it("should suppress hover on short blocks when disableHover=always", async ({ browser }) => {
            await browser.url("suppress-interactions-hover.html");

            await browser.$("[data-testid=short-block]").moveTo();

            await browser.assertView("short-block-suppress-on", "[data-testid=short-block]", {
                disableHover: "always",
            });

            // Previous assertView should not affect future behavior
            await browser.$("[data-testid=short-block]").click();
            await browser.assertView("short-block-final", "[data-testid=short-block]");
        });

        it("should suppress hover on long blocks by default during composite", async ({ browser }) => {
            await browser.url("suppress-interactions-hover.html");

            await browser.$("[data-testid=long-block]").moveTo();

            await browser.assertView("long-block-suppress-default", "[data-testid=long-block]");
        });

        it("should keep hover on long blocks when disableHover=never", async ({ browser }) => {
            await browser.url("suppress-interactions-hover.html");

            await browser.$("[data-testid=long-block]").moveTo();

            await browser.assertView("long-block-suppress-off", "[data-testid=long-block]", {
                disableHover: "never",
            });
        });
    });

    describe("disableAnimation", () => {
        it("should stop and resume animations on a basic page", async ({ browser }) => {
            await browser.url("animation-cleanup.html");

            // This pause is to ensure the test fails if animations are not stopped
            await browser.pause(Math.random() * 500);

            await browser.assertView("animation-cleanup", "[data-testid=animated-block]", { disableAnimation: true });

            const state = await browser.execute(() => {
                const targetElement = document.querySelector("[data-testid=animated-block]");
                const animationDuration = window.getComputedStyle(targetElement).animationDuration;
                const hasStyle = Array.from(document.querySelectorAll("style")).some(style =>
                    style.textContent.includes("animation-duration: 0ms"),
                );

                return {
                    animationDuration,
                    someElementHasAnimationStoppedStyle: hasStyle,
                };
            });

            expect(state.someElementHasAnimationStoppedStyle).toBe(false);
            expect(state.animationDuration).toBe("0.2s");
        });

        it("should stop and resume animations in iframe and restore frame context", async ({ browser }) => {
            await browser.url("animation-cleanup.html");

            await browser.execute(() => {
                window.__thisIsOriginalFrame = true;
            });

            // This pause is to ensure the test fails if animations are not stopped
            await browser.pause(Math.random() * 500);

            await browser.assertView("animation-cleanup-iframe", "[data-testid=animation-iframe]", {
                disableAnimation: true,
            });

            const state = await browser.execute(() => {
                const isOriginalFrame = window.__thisIsOriginalFrame;

                const iframe = document.querySelector("[data-testid=animation-iframe]");
                const iframeWindow = iframe.contentWindow;
                const iframeDocument = iframe.contentDocument;
                const iframeElement = iframeDocument.querySelector("[data-testid=animated-block]");
                const animationDuration = iframeWindow.getComputedStyle(iframeElement).animationDuration;
                const hasStyle = Array.from(iframeDocument.querySelectorAll("style")).some(style =>
                    style.textContent.includes("animation-duration: 0ms"),
                );

                return {
                    isOriginalFrame,
                    animationDuration,
                    someElementHasAnimationStoppedStyle: hasStyle,
                };
            });

            expect(state.isOriginalFrame).toBe(true);
            expect(state.someElementHasAnimationStoppedStyle).toBe(false);
            expect(state.animationDuration).toBe("0.3s");
        });

        it("should resume animations after assertView failure", async ({ browser }) => {
            await browser.url("animation-cleanup.html");

            await expect(() =>
                browser.assertView("animation-cleanup-fail", "[data-testid=too-tall]", {
                    disableAnimation: true,
                    compositeImage: false,
                    captureElementFromTop: true,
                }),
            ).rejects.toThrow();

            const state = await browser.execute(() => {
                const targetElement = document.querySelector("[data-testid=animated-block]");
                const animationDuration = window.getComputedStyle(targetElement).animationDuration;
                const hasStyle = Array.from(document.querySelectorAll("style")).some(style =>
                    style.textContent.includes("animation-duration: 0ms"),
                );

                return {
                    animationDuration,
                    someElementHasAnimationStoppedStyle: hasStyle,
                };
            });

            expect(state.someElementHasAnimationStoppedStyle).toBe(false);
            expect(state.animationDuration).toBe("0.2s");
        });
    });

    it("should work fine when capturing elements that are overlapping", async ({ browser }) => {
        await browser.url("overlapping-blocks-at-y2000.html");

        await expect(() =>
            browser.assertView("text-block", "[data-testid=text-block]", { captureElementFromTop: false }),
        ).rejects.toThrow("The element is completely obscured by fixed or sticky elements");
    });
});
