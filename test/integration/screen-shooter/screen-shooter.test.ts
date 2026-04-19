import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import { strict as assert } from "assert";
import path from "node:path";

import looksSame from "looks-same";
import sinon from "sinon";
import { launchBrowser } from "../../../src/browser/standalone";
import { BROWSER_CONFIG } from "../standalone/constants";
import { Camera } from "../../../src/browser/camera";
import { ElementsScreenShooter } from "../../../src/browser/screen-shooter/elements-screen-shooter";
import type { WdioBrowser } from "../../../src/types";

import _ from "lodash";
import { closeServer, startFixtureServer } from "./utils";

const SCREENSHOTS_PATH = path.join(__dirname, "screens");
const HORIZONTAL_OVERFLOW_WARNING_PART = "outside of horizontal viewport bounds";
const TEMP_DIR_PREFIX = "testplane-elements-screen-shooter-";

const createScreenShooter = async (browser: WdioBrowser): Promise<ElementsScreenShooter> => {
    const camera = Camera.create("auto", () => browser.takeScreenshot());

    return ElementsScreenShooter.create({
        browser,
        camera,
        browserProperties: {
            isWebdriverProtocol: true,
            shouldUsePixelRatio: true,
            needsCompatLib: false,
        },
    });
};

describe("ElementsScreenShooter integration", function () {
    this.timeout(60000);

    let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
    let server: http.Server | null = null;
    let tempDir: string | null = null;
    let pageUrl = "";
    let warningSpy: sinon.SinonSpy | null = null;

    beforeEach(async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
        browser = await launchBrowser({
            ...BROWSER_CONFIG,
            windowSize: "1280x1000",
        });
    });

    afterEach(async () => {
        if (browser) {
            await browser.deleteSession();
            browser = null;
        }

        if (tempDir && !process.env.KEEP_ACTUAL) {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
            tempDir = null;
        }

        if (warningSpy) {
            warningSpy.restore();
            warningSpy = null;
        }
    });

    before(async () => {
        ({ server, pageUrl } = await startFixtureServer());
    });

    after(async () => {
        if (server) {
            await closeServer(server);
            server = null;
        }
    });

    it("prints horizontal overflow warning and captures only visible part", async () => {
        assert.ok(tempDir);
        await browser!.url(`${pageUrl}/partially-offscreen.html`);

        warningSpy = sinon.spy(console, "warn");

        const screenShooter = await createScreenShooter(browser as WdioBrowser);

        const { image } = await screenShooter.capture("#partially-offscreen");

        const warningOutput = warningSpy
            .getCalls()
            .flatMap(call => call.args)
            .map(String)
            .join("\n");

        assert(warningSpy.callCount >= 1, "Expected warning to be printed");
        assert(
            warningOutput.includes(HORIZONTAL_OVERFLOW_WARNING_PART),
            "Expected warning to contain horizontal overflow warning part",
        );
        assert(
            warningOutput.includes("#partially-offscreen"),
            "Expected warning to contain partially offscreen element selector",
        );

        const actualImagePath = path.join(tempDir, "partially-offscreen.actual.png");
        await image.save(actualImagePath);

        const expectedImagePath = path.join(SCREENSHOTS_PATH, "partially-offscreen.png");

        if (process.env.UPDATE_REFERENCES) {
            await fs.promises.copyFile(actualImagePath, expectedImagePath);
        }

        const comparison = await looksSame(actualImagePath, expectedImagePath);
        assert(comparison.equal, "Expected screenshot to match reference image");
    });

    it("captures long screenshot with deterministic geometry changes", async () => {
        assert.ok(tempDir);
        await browser!.url(`${pageUrl}/deterministic-changing-dimensions.html`);

        const screenShooter = await createScreenShooter(browser as WdioBrowser);
        const { image } = await screenShooter.capture(".Modal-Content", {
            compositeImage: true,
            selectorToScroll: ".Modal-Wrapper",
        });

        const actualImagePath = path.join(tempDir, "deterministic-changing-dimensions.png");
        await image.save(actualImagePath);

        const stat = await fs.promises.stat(actualImagePath);
        assert(stat.size > 0, "Expected deterministic screenshot image to be saved");

        const expectedImagePath = path.join(SCREENSHOTS_PATH, "deterministic-changing-dimensions.png");

        if (process.env.UPDATE_REFERENCES) {
            await fs.promises.copyFile(actualImagePath, expectedImagePath);
        }

        const comparison = await looksSame(actualImagePath, expectedImagePath);
        assert(comparison.equal, "Expected screenshot to match reference image");
    });

    it("captures full page body with dynamic sticky menu fixture", async () => {
        assert.ok(tempDir);
        await browser!.url(`${pageUrl}/dynamic-sticky-menu-safe-area.html`);

        const screenShooter = await createScreenShooter(browser as WdioBrowser);
        const { image } = await screenShooter.capture("body", {
            compositeImage: true,
            allowViewportOverflow: true,
            captureElementFromTop: false,
            disableAnimation: true,
        });

        const actualImagePath = path.join(tempDir, "dynamic-sticky-menu-safe-area.png");
        await image.save(actualImagePath);

        const expectedImagePath = path.join(SCREENSHOTS_PATH, "dynamic-sticky-menu-safe-area.png");

        if (process.env.UPDATE_REFERENCES) {
            await fs.promises.copyFile(actualImagePath, expectedImagePath);
        }

        const comparison = await looksSame(actualImagePath, expectedImagePath);
        assert(comparison.equal, "Expected screenshot to match reference image");
    });

    it("captures only the visible part of a long block when allowViewportOverflow=true and captureElementFromTop=false", async () => {
        assert.ok(tempDir);
        await browser!.url(`${pageUrl}/visible-top-long-block-overflow.html`);

        const screenShooter = await createScreenShooter(browser as WdioBrowser);
        const { image } = await screenShooter.capture("#visible-top-long-block", {
            allowViewportOverflow: true,
            captureElementFromTop: false,
            disableAnimation: true,
        });

        const actualImagePath = path.join(tempDir, "visible-top-long-block-overflow.png");
        await image.save(actualImagePath);

        const expectedImagePath = path.join(SCREENSHOTS_PATH, "visible-top-long-block-overflow.png");

        if (process.env.UPDATE_REFERENCES) {
            await fs.promises.copyFile(actualImagePath, expectedImagePath);
        }

        const comparison = await looksSame(actualImagePath, expectedImagePath);
        assert(comparison.equal, "Expected screenshot to match reference image");
    });

    it("should save best-effort screenshot on non-deterministic geometry changes", async () => {
        assert.ok(browser);

        await browser!.url(`${pageUrl}/non-deterministic-changing-dimensions.html`);

        const screenShooter = await createScreenShooter(browser as WdioBrowser);

        await assert.doesNotReject(() =>
            screenShooter.capture(".Modal-Content", {
                compositeImage: true,
                selectorToScroll: ".Modal-Wrapper",
            }),
        );
    });

    it("keeps fractional checkpoint offsets stable during replay", async () => {
        assert.ok(browser);
        const browserConfig = _.cloneDeep(BROWSER_CONFIG);
        // This test is only applicable to Chrome, it's hard to replicate the issue in firefox
        if (BROWSER_CONFIG.desiredCapabilities.browserName !== "chrome") {
            return;
        }

        _.set(browserConfig.desiredCapabilities, "goog:chromeOptions", {
            args: [
                "--force-device-scale-factor=3",
                "--high-dpi-support=1",
                "--screen-info={devicePixelRatio=3}",
                "--enable-gpu-rasterization",
                "--enable-oop-rasterization",
                "--ignore-gpu-blocklist",
                "--enable-features=FractionalScrollOffsets",
            ],
            mobileEmulation: {
                deviceMetrics: {
                    width: 375,
                    height: 667,
                    pixelRatio: 3,
                },
            },
        });
        const mobileBrowser = await launchBrowser(browserConfig);
        await mobileBrowser!.url(`${pageUrl}/fractional-scroll-checkpoint-stability.html`);

        try {
            const screenShooter = await createScreenShooter(mobileBrowser as WdioBrowser);

            await assert.doesNotReject(() =>
                screenShooter.capture(".Content", {
                    compositeImage: true,
                }),
            );
        } finally {
            await mobileBrowser!.deleteSession();
        }
    });

    it("captures fixed block slightly off viewport", async () => {
        assert.ok(browser);
        assert.ok(tempDir);

        await browser!.url(`${pageUrl}/fixed-block-slightly-off-viewport.html`);

        const screenShooter = await createScreenShooter(browser as WdioBrowser);
        const { image } = await screenShooter.capture("#partially-offscreen", {
            compositeImage: true,
        });

        const actualImagePath = path.join(tempDir, "fixed-block-slightly-off-viewport.png");
        await image.save(actualImagePath);

        const expectedImagePath = path.join(SCREENSHOTS_PATH, "fixed-block-slightly-off-viewport.png");

        if (process.env.UPDATE_REFERENCES) {
            await fs.promises.copyFile(actualImagePath, expectedImagePath);
        }

        const comparison = await looksSame(actualImagePath, expectedImagePath);
        assert(comparison.equal, "Expected screenshot to match reference image");
    });
});
