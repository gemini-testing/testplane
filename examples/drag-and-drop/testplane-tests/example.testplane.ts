describe("test", () => {
    it("drag-and-drop", async ({browser}) => {
        await browser.url("/");

        const image = await browser.$('[data-qa="draggable-image"]');
        const elementToDropTo = await browser.$('[data-qa="second-elem"]');

        // state before DnD - the picture must be within the first div
        await browser.assertView('before', '.dnd');

        await image.dragAndDrop(elementToDropTo, {duration: 1000});

        // state after DnD - the picture must be within the second div
        await browser.assertView('after', '.dnd');
    });
});
