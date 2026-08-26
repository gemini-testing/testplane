import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { resolveChromeBuildIdFromMirror as ResolveChromeBuildIdFromMirror } from "../../../../src/browser-installer/chrome/utils";

describe("browser-installer/chrome/utils", () => {
    const sandbox = sinon.createSandbox();
    const mirror = "https://mirror.example/chrome";

    let retryFetchStub: SinonStub;
    let resolveChromeBuildIdFromMirror: typeof ResolveChromeBuildIdFromMirror;

    beforeEach(() => {
        retryFetchStub = sandbox.stub();
        resolveChromeBuildIdFromMirror = proxyquire("../../../../src/browser-installer/chrome/utils", {
            "../utils": {
                ...require("src/browser-installer/utils"),
                retryFetch: retryFetchStub,
            },
        }).resolveChromeBuildIdFromMirror;
    });

    afterEach(() => sandbox.restore());

    it("should resolve milestone from mirrored metadata", async () => {
        retryFetchStub.resolves({
            json: () => Promise.resolve({ milestones: { "115": { version: "115.0.5790.170" } } }),
        });

        const result = await resolveChromeBuildIdFromMirror("115", mirror);

        assert.equal(result, "115.0.5790.170");
        assert.calledOnceWith(retryFetchStub, `${mirror}/latest-versions-per-milestone.json`);
    });

    it("should resolve two-part version from mirrored milestone metadata", async () => {
        retryFetchStub.resolves({
            json: () => Promise.resolve({ milestones: { "115": { version: "115.0.5790.170" } } }),
        });

        const result = await resolveChromeBuildIdFromMirror("115.0", mirror);

        assert.equal(result, "115.0.5790.170");
        assert.calledOnceWith(retryFetchStub, `${mirror}/latest-versions-per-milestone.json`);
    });

    it("should resolve build prefix from mirrored build metadata", async () => {
        retryFetchStub.resolves({
            json: () => Promise.resolve({ builds: { "115.0.5790": { version: "115.0.5790.170" } } }),
        });

        const result = await resolveChromeBuildIdFromMirror("115.0.5790", mirror);

        assert.equal(result, "115.0.5790.170");
        assert.calledOnceWith(retryFetchStub, `${mirror}/latest-patch-versions-per-build.json`);
    });

    it("should use exact version without metadata request", async () => {
        const result = await resolveChromeBuildIdFromMirror("115.0.5790.170", mirror);

        assert.equal(result, "115.0.5790.170");
        assert.notCalled(retryFetchStub);
    });

    for (const [selector, channel] of [
        ["stable", "STABLE"],
        ["beta", "BETA"],
        ["dev", "DEV"],
        ["canary", "CANARY"],
        ["latest", "CANARY"],
    ]) {
        it(`should resolve ${selector} channel from mirror`, async () => {
            retryFetchStub.resolves({ text: () => Promise.resolve(" \n115.0.5790.170\t") });

            const result = await resolveChromeBuildIdFromMirror(selector, mirror);

            assert.equal(result, "115.0.5790.170");
            assert.calledOnceWith(retryFetchStub, `${mirror}/LATEST_RELEASE_${channel}`);
        });
    }

    for (const [selector, metadata] of [
        ["999", { milestones: {} }],
        ["115.0.9999", { builds: {} }],
    ] as const) {
        it(`should throw a clear error when ${selector} cannot be resolved`, async () => {
            retryFetchStub.resolves({ json: () => Promise.resolve(metadata) });

            await assert.isRejected(
                resolveChromeBuildIdFromMirror(selector, mirror),
                `Couldn't resolve Chrome-for-Testing build ID for selector '${selector}' from the configured mirror`,
            );
        });
    }

    it("should reject milestone metadata for a different milestone", async () => {
        retryFetchStub.resolves({
            json: () => Promise.resolve({ milestones: { "115": { version: "116.0.5845.96" } } }),
        });

        await assert.isRejected(
            resolveChromeBuildIdFromMirror("115", mirror),
            `Couldn't resolve Chrome-for-Testing build ID for selector '115' from the configured mirror`,
        );
    });

    it("should reject milestone metadata that does not match a two-part selector", async () => {
        retryFetchStub.resolves({
            json: () => Promise.resolve({ milestones: { "115": { version: "115.1.5790.170" } } }),
        });

        await assert.isRejected(
            resolveChromeBuildIdFromMirror("115.0", mirror),
            `Couldn't resolve Chrome-for-Testing build ID for selector '115.0' from the configured mirror`,
        );
    });

    it("should normalize malformed mirror metadata errors", async () => {
        retryFetchStub.resolves({ json: () => Promise.resolve(null) });

        await assert.isRejected(
            resolveChromeBuildIdFromMirror("115", mirror),
            `Couldn't resolve Chrome-for-Testing build ID for selector '115' from the configured mirror`,
        );
    });

    it("should not expose the configured mirror in network errors", async () => {
        retryFetchStub.rejects(new Error(`Failed to fetch ${mirror}/latest-versions-per-milestone.json`));

        const error = (await resolveChromeBuildIdFromMirror("115", mirror).catch(err => err)) as Error;

        assert.equal(
            error.message,
            `Couldn't resolve Chrome-for-Testing build ID for selector '115' from the configured mirror`,
        );
        assert.notInclude(error.message, mirror);
    });

    it("should throw a clear error when channel metadata is empty", async () => {
        retryFetchStub.resolves({ text: () => Promise.resolve(" \n") });

        await assert.isRejected(
            resolveChromeBuildIdFromMirror("stable", mirror),
            `Couldn't resolve Chrome-for-Testing build ID for selector 'stable' from the configured mirror`,
        );
    });

    it("should reject unsupported selectors without requesting metadata", async () => {
        await assert.isRejected(
            resolveChromeBuildIdFromMirror("nightly", mirror),
            `Couldn't resolve Chrome-for-Testing build ID for selector 'nightly' from the configured mirror`,
        );
        assert.notCalled(retryFetchStub);
    });
});
