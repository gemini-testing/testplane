const useWithoutAnAccountBtnSelector = 'android=new UiSelector().resourceId("com.android.chrome:id/signin_fre_dismiss_button")';
const gotItBtnSelector = 'android=new UiSelector().resourceId("com.android.chrome:id/ack_button")';

const NATIVE_CONTEXT = "NATIVE_APP";
const WEBVIEW_CONTEXT = "WEBVIEW_chrome";

describe("hybrid", () => {
    it("example", async ({browser}) => {
        await browser.$(useWithoutAnAccountBtnSelector).click();
        await browser.$(gotItBtnSelector).click();

        await browser.switchContext(WEBVIEW_CONTEXT);

        const contexts = await browser.getContexts();

        // TODO: write more useful checks
        expect(contexts.length).toBe(2);
        expect(contexts[0]).toBe(NATIVE_CONTEXT);
        expect(contexts[1]).toBe(WEBVIEW_CONTEXT);
    });
});
