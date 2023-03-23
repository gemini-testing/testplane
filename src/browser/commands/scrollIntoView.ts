type Browser = {
    publicAPI: WebdriverIO.Browser;
};

// TODO: remove after fix https://github.com/webdriverio/webdriverio/issues/9620
export = async (browser: Browser) => {
    const { publicAPI: session } = browser;

    session.overwriteCommand(
        "scrollIntoView",
        async function (
            this: WebdriverIO.Element,
            _origScrollIntoView,
            options: ScrollIntoViewOptions | boolean = { block: "start", inline: "nearest" },
        ): Promise<void> {
            await session.execute<Promise<void>, [WebdriverIO.Element, ScrollIntoViewOptions | boolean]>(
                (elem, options) => elem.scrollIntoView(options),
                this,
                options,
            );
        },
        true,
    );
};
