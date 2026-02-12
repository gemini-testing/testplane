export {};

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace ExpectWebdriverIO {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        interface Matchers<R, T> {
            toBeDisplayed(options?: ExpectWebdriverIO.CommandOptions): Promise<R>;
            toExist(options?: ExpectWebdriverIO.CommandOptions): Promise<R>;
            toBePresent(options?: ExpectWebdriverIO.CommandOptions): Promise<R>;
            toBeExisting(options?: ExpectWebdriverIO.CommandOptions): Promise<R>;
            toHaveAttribute(
                attribute: string,
                value?: string | RegExp,
                options?: ExpectWebdriverIO.StringOptions,
            ): Promise<R>;
            toHaveAttr(
                attribute: string,
                value?: string | RegExp,
                options?: ExpectWebdriverIO.StringOptions,
            ): Promise<R>;
            toHaveAttributeContaining(
                attribute: string,
                contains: string | RegExp,
                options?: ExpectWebdriverIO.StringOptions,
            ): Promise<R>;
            toHaveAttrContaining(
                attribute: string,
                contains: string | RegExp,
                options?: ExpectWebdriverIO.StringOptions,
            ): Promise<R>;
            toHaveClass(className: string | RegExp, options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toHaveElementClass(className: string | RegExp, options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toHaveClassContaining(className: string | RegExp, options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toHaveElementClassContaining(
                className: string | RegExp,
                options?: ExpectWebdriverIO.StringOptions,
            ): Promise<R>;
            toHaveElementProperty(
                property: string | RegExp,
                value?: unknown,
                options?: ExpectWebdriverIO.StringOptions,
            ): Promise<R>;
            toHaveValue(value: string | RegExp, options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toHaveValueContaining(value: string | RegExp, options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toBeClickable(options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toBeDisabled(options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toBeDisplayedInViewport(options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toBeEnabled(options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toBeFocused(options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toBeSelected(options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toBeChecked(options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toHaveChildren(
                size?: number | ExpectWebdriverIO.NumberOptions,
                options?: ExpectWebdriverIO.NumberOptions,
            ): Promise<R>;
            toHaveHref(href: string | RegExp, options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toHaveLink(href: string | RegExp, options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toHaveHrefContaining(href: string | RegExp, options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toHaveLinkContaining(href: string | RegExp, options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toHaveId(id: string | RegExp, options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toHaveText(
                text: string | RegExp | Array<string | RegExp>,
                options?: ExpectWebdriverIO.StringOptions,
            ): Promise<R>;
            toHaveTextContaining(
                text: string | RegExp | Array<string | RegExp>,
                options?: ExpectWebdriverIO.StringOptions,
            ): Promise<R>;
            toHaveStyle(style: { [key: string]: string }, options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toHaveUrl(url: string | RegExp, options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toHaveUrlContaining(url: string | RegExp, options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toHaveTitle(title: string | RegExp, options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toHaveTitleContaining(title: string | RegExp, options?: ExpectWebdriverIO.StringOptions): Promise<R>;
            toBeElementsArrayOfSize(
                size: number | ExpectWebdriverIO.NumberOptions,
                options?: ExpectWebdriverIO.NumberOptions,
            ): Promise<R>;
            toBeRequested(options?: ExpectWebdriverIO.CommandOptions): Promise<R>;
            toBeRequestedTimes(
                times: number | ExpectWebdriverIO.NumberOptions,
                options?: ExpectWebdriverIO.NumberOptions,
            ): Promise<R>;
            toBeRequestedWith(
                requestedWith: ExpectWebdriverIO.RequestedWith,
                options?: ExpectWebdriverIO.CommandOptions,
            ): Promise<R>;
        }
    }
}
