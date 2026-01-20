import type {} from "testplane";

it("example", async ({browser}) => {
    // testing library matcher
    await expect(browser.$("some elem")).toContainHTML("<span>some html</span>");

    // testing library browser selector
    await browser.getByAltText("some text", {collapseWhitespace: true})

    // testing library element selector
    const element = await browser.$("some elem");
    const _ = element.getByAltText("some text", {exact: true});

    // testing library chainable selector
    await browser.$("some elem").getByText("some text", {trim: true});
});
