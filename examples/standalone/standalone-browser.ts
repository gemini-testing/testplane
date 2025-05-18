import { launchBrowser } from "../../build/src/unstable";

async function example() {
    console.log("Starting basic example with Chrome browser...");
    let browser;
    
    try {
        browser = await launchBrowser({system: {debug: true}});

        await browser.url("https://www.google.com");

        const title = await browser.getTitle();
        console.log(`Page title: ${title}`);
        
        await browser.saveScreenshot("./google.png");
        console.log("Screenshot saved to ./google.png");
    } catch (e) {
        console.error(e);
    } finally {
        await browser?.deleteSession();
    }
}

(async () => {
    await example();
})();
