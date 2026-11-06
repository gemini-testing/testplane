import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sinon from "sinon";
import { Test } from "../../../../src/test-reader/test-object";
import { TestCollection } from "../../../../src/test-collection";
import { TestPreflightError } from "../../../../src/errors/test-preflight-error";
import { validateTestCollection } from "../../../../src/test-reader/await-check";
import stripAnsi from "strip-ansi";

describe("missing await collection validation", function () {
    this.timeout(20000);
    let dir: string;
    const bad = "it('x', ({browser}) => { browser.assertView('plane'); });\n";
    const good = "it('x', async ({browser}) => { await browser.assertView('plane'); });\n";
    const test = (file: string): Test => Test.create({ title: "x", id: "x", file, location: undefined, fn() {} });
    const collection = (...files: string[]): TestCollection => TestCollection.create({ chrome: files.map(test) });
    const write = async (name: string, source: string): Promise<string> => {
        const file = path.join(dir, name);
        await fs.writeFile(file, source);
        return file;
    };
    const rejected = async (promise: Promise<void>): Promise<TestPreflightError> =>
        promise.then(
            () => assert.fail("expected preflight rejection"),
            error => {
                assert.instanceOf(error, TestPreflightError);
                return error;
            },
        );

    beforeEach(async () => {
        dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "testplane-await-files-")));
    });
    afterEach(async () => {
        sinon.restore();
        await fs.rm(dir, { recursive: true, force: true });
    });

    it("should reject all errors across files in deterministic order", async () => {
        const b = await write("b.ts", bad);
        const a = await write("a.js", bad + bad);
        const error = await rejected(validateTestCollection(collection(b, a)));
        assert.deepEqual(
            error.diagnostics.map(d => [path.basename(d.file), d.line]),
            [
                ["a.js", 1],
                ["a.js", 2],
                ["b.ts", 1],
            ],
        );
        assert.include(error.stack!, "No tests were started");
        assert.include(stripAnsi(error.stack!), "browser.assertView('plane')");
        assert.include(error.stack!, a + ":1:26");
    });
    it("should analyze a real file only once across browsers and symlinks", async () => {
        const file = await write("a.js", bad);
        const alias = path.join(dir, "alias.js");
        await fs.symlink(file, alias);
        const read = sinon.spy(fs, "readFile");
        const coll = TestCollection.create({ chrome: [test(file)], firefox: [test(alias), test(file)] });
        const error = await rejected(validateTestCollection(coll));
        assert.lengthOf(error.diagnostics, 1);
        assert.calledOnce(read);
    });
    it("should accept file URLs", async () => {
        const file = await write("a.js", bad);
        const error = await rejected(validateTestCollection(collection(pathToFileURL(file).href)));
        assert.equal(error.diagnostics[0].file, file);
    });
    it("should aggregate missing, unsupported and syntactically invalid files with missing awaits", async () => {
        const badFile = await write("a.ts", bad);
        const syntax = await write("b.ts", "it('x', () => { const = });");
        const unsupported = await write("c.unknown", "");
        const error = await rejected(
            validateTestCollection(collection(badFile, syntax, unsupported, path.join(dir, "missing.js"))),
        );
        assert.sameMembers(
            error.diagnostics.map(d => d.code),
            ["missing-await", "parse-error", "unsupported-file", "read-error"],
        );
    });
    it("should not request HTTP sources", async () => {
        const fetch = sinon.spy(globalThis, "fetch");
        const error = await rejected(validateTestCollection(collection("https://example.test/spec.js")));
        assert.equal(error.diagnostics[0].code, "unsupported-file");
        assert.notCalled(fetch);
    });
    it("should reject active synthetic tests without source files", async () => {
        const error = await rejected(validateTestCollection(collection("")));
        assert.equal(error.diagnostics[0].code, "missing-source");
    });
    it("should skip empty, disabled and pending collections without reading files", async () => {
        const read = sinon.spy(fs, "readFile");
        const disabled = test(path.join(dir, "disabled.js"));
        disabled.disable();
        const pending = test(path.join(dir, "pending.js"));
        pending.pending = true;
        await validateTestCollection(TestCollection.create({ chrome: [] }));
        await validateTestCollection(TestCollection.create({ chrome: [disabled, pending] }));
        assert.notCalled(read);
    });
    it("should validate the entire selected file including skipped callbacks and inline hooks", async () => {
        const file = await write(
            "a.js",
            good +
                "it.skip('y', ({browser}) => { browser.url('/'); });\nbeforeEach(({browser}) => { browser.getUrl(); });",
        );
        const error = await rejected(validateTestCollection(collection(file)));
        assert.deepEqual(
            error.diagnostics.map(d => d.code === "missing-await" && d.command),
            ["url", "getUrl"],
        );
    });
    it("should not include unselected helper or hook-only files", async () => {
        const file = await write("a.js", good);
        await write("hooks.js", "beforeEach(({browser}) => { browser.url('/'); });");
        await write("helper.js", bad);
        await validateTestCollection(collection(file));
    });
    it("should reread corrected source on the next validation", async () => {
        const file = await write("a.js", bad);
        await rejected(validateTestCollection(collection(file)));
        await fs.writeFile(file, good);
        await validateTestCollection(collection(file));
    });
    it("should reject unsupported UI instead of silently passing", async () => {
        const file = await write("a.js", good);
        const error = await rejected(validateTestCollection(collection(file), { mochaUi: "exports" }));
        assert.equal(error.diagnostics[0].code, "unsupported-ui");
    });
    it("should report invalid tsconfig rather than claiming full analysis", async () => {
        const file = await write("a.ts", bad);
        await write("tsconfig.json", "{broken");
        const error = await rejected(validateTestCollection(collection(file)));
        assert.equal(error.diagnostics[0].code, "parse-error");
    });
});
