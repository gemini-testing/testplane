import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

type TestContext = {
    browser: any;
};

// Bound here so REPL e2e assertions can read it through generated context.
const rootValue: number = 1000;
void rootValue;

const pageUrl: string = pathToFileURL(path.join(process.cwd(), "page.html")).href;

// @ts-expect-error Testplane passes a context object into Mocha test callbacks.
it("opens repl from test code", async ({ browser }: TestContext): Promise<void> => {
    // Bound here so REPL e2e assertions can read it through generated context.
    const localValue: number = 234;
    void localValue;

    await browser.url(pageUrl);
    await browser.switchToRepl();
    const anotherValue = 12222;
    console.log(anotherValue);
    await browser.$("#action").click();

    assert.equal(await browser.$("#message").getText(), "Clicked from fixture");
});
