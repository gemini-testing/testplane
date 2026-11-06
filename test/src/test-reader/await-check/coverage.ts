import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeMissingAwait } from "../../../../src/test-reader/await-check/analyze";
import { createTypeProgram } from "../../../../src/test-reader/await-check/type-info";

const reviewCases: Array<[string, string[]]> = [
    ['const p = browser.url("/"); try { return p; } catch {}', []],
    ['try { return browser.url("/"); } catch {}', []],
    ['if (flag) { const p = browser.url("/"); }', ["url"]],
    ['const p = browser.url("/"); await browser.runStep("step", async () => { await p; });', []],
    ['await browser.runStep("step", () => [browser.url("/")]);', ["url"]],
    ['const ps = await browser.runStep("step", () => [browser.url("/")]); await Promise.all(ps);', []],
    ['const ps = [browser.url("/"), browser.assertView("a")]; for await (const p of ps) { break; }', ["assertView"]],
    ['await browser.$$("a").map(async el => await el.click());', []],
    ['const els = await browser.$$("a"); await els.forEach(async el => await el.click());', []],
    ['browser.$$("a").map(async el => await el.click());', ["map"]],
    ['const els = await browser.$$("a"); els.forEach(async el => await el.click());', ["forEach"]],
    ['await browser.$$("a").map(async el => { el.click(); });', ["click"]],
    ['const p = browser.url("/"); if (flag) { const q = p; }', ["url"]],
    ['const p = browser.url("/"); if (flag) { const q = p; } else { const r = p; }', ["url"]],
    ['const p = browser.url("/"); if (flag) { const q = p; await q; }', ["url"]],
    ['const p = browser.url("/"); if (flag) { const q = p; await q; } else { const r = p; await r; }', []],
    ['const p = browser.url("/"); if (flag) { const q = p; } await p;', []],
    ['const p = browser.url("/"); try { await p; } catch {}', []],
    ['try { browser.url("/"); } catch {}', ["url"]],
    ['const p = browser.url("/"); try { throw Error(); } catch {}', ["url"]],
    ['try { await browser.assertView("a"); } catch { browser.url("/"); }', ["url"]],
    ['const ps = [browser.url("/")]; for (const p of ps) { await p; }', []],
    ['const ps = [browser.url("/"), browser.assertView("a")]; for (const p of ps) { await p; }', []],
    ['const ps = [browser.url("/"), browser.assertView("a")]; for await (const p of ps) {}', []],
    ['const ps = [browser.url("/"), browser.assertView("a")]; for (const p of ps) { await p; break; }', ["assertView"]],
    [
        'const ps = [browser.url("/"), browser.assertView("a")]; for (const p of ps) { await p; return; }',
        ["assertView"],
    ],
    ['const p = browser.url("/"); await Promise.resolve().then(() => p);', []],
    ['const p = browser.url("/"); await Promise.resolve().then(async () => { await p; });', []],
    ['const p = browser.url("/"); await Promise.resolve().then(() => { p; });', ["url"]],
    ['const ps = [browser.url("/")]; await Promise.all(ps.map(p => p));', []],
    ['const ps = [browser.url("/"), browser.assertView("a")]; await Promise.all(ps.map(p => p));', []],
    ['await Promise.all([[browser.url("/")]]);', ["url"]],
    ['await Promise.resolve().then(() => [browser.url("/")]);', ["url"]],
    ['const ps = await Promise.resolve().then(() => [browser.url("/")]); await Promise.all(ps);', []],
    ['const helper = () => [browser.url("/")]; await Promise.all(helper());', []],
    ['const ps = [browser.url("/")]; await Promise.all([...ps]);', []],
    ['const ps = [browser.url("/")]; await Promise.all(ps.map(p => [p]));', ["url"]],
    ['const p = browser.url("/"); function helper() {} helper(p);', ["url"]],
];

describe("missing await coverage", () => {
    const cases: Array<[string, string[]]> = [
        ...reviewCases.map(([body, expected]): [string, string[]] => [
            `it("x", async ({browser}) => { ${body} });`,
            expected,
        ]),
        ["it('x', function () { this.browser.assertView('x'); });", ["assertView"]],
        ["it('x', async ctx => { const bro = ctx.browser; bro.url('/'); });", ["url"]],
        ["it('x', async ({browser: bro}) => { bro['assertView']('x'); });", ["assertView"]],
        ["it.skip('x', ({browser}) => { browser?.assertView('x'); });", ["assertView"]],
        ["it('x', ({browser}) => browser.assertView('x'));", []],
        ["it('x', async ({browser}) => { const p = browser.url('/'); return p; });", []],
        ["it('x', async ({browser}) => { const p = browser.url('/'); try { return p; } finally {} });", []],
        [
            "it('x', async ({browser}) => { const p = browser.url('/'); try { return p; } finally { return; } });",
            ["url"],
        ],
        ["it('x', ({browser}) => { try { browser.url('/'); throw Error(); } catch {} });", ["url"]],
        ["it('x', function () { (() => { this.browser.url('/'); })(); });", ["url"]],
        ["it('x', function () { function helper() { this.browser.url('/'); } helper(); });", []],
        ["it('x', ({browser}) => { browser.on('event', () => { browser.url('/'); }); });", ["url"]],
        ["it('x', function (this: unknown, {browser}) { browser.url('/'); });", ["url"]],
        ["import {it as test} from 'testplane'; test('x', ({browser}) => { browser.url('/'); });", ["url"]],
        ["const {it: test} = require('mocha'); test('x', ({browser}) => { browser.url('/'); });", ["url"]],
        ["function it(name, cb) {} it('x', ({browser}) => { browser.url('/'); });", []],
        ["it('x', ({browser}) => { const Promise = {all() {}}; Promise.all([]); });", []],
        ["it('x', ({browser}) => { if(flag) { const browser = {}; browser.url('/'); } });", []],
        ["it('x', ({browser}) => { browser.addCommand('custom', () => {}); browser.custom(); });", ["custom"]],
        [
            "it('x', ({browser}) => { browser.addCommand('custom', () => {}, true); browser.$('a').custom(); });",
            ["custom"],
        ],
        [
            "it('x', ({browser}) => { browser.getUrl(); browser.getConfig(); browser.addTag('a'); });",
            ["getUrl", "getConfig", "addTag"],
        ],
        ["it('x', ({browser}) => { browser.$$('a')[0].click(); });", ["click"]],
        ["it('x', async ({browser}) => { const els = await browser.$$('a'); els[0].click(); });", ["click"]],
        ["it('x', ({browser}) => { flag ? browser.url('/') : browser.assertView('a'); });", ["url", "assertView"]],
        ["it('x', async ({browser}) => { await (flag ? browser.url('/') : browser.assertView('a')); });", []],
        ["it('x', async ({browser}) => { const p = browser.url('/'); while(flag) { await p; } });", ["url"]],
        ["it('x', async ({browser}) => { for (const item of ['a']) { await browser.assertView(item); } });", []],
        [
            "it('x', async ({browser}) => { const p = browser.url('/'); const ps = [p]; await Promise.allSettled(ps); });",
            [],
        ],
        ["it('x', async ({browser}) => { await Promise.resolve([browser.url('/')]); });", ["url"]],
        ["it('x', async ({browser}) => { await browser.executeAsync(() => { browser.url('/'); }); });", []],
        ["it('x', ({browser}) => { const p = browser.url('/'); const box = {p}; });", []],
        ["it('x', ({browser}) => { browser[dynamicName](); });", []],
    ];
    for (const [source, expected] of cases) {
        it(source, () =>
            assert.deepEqual(
                analyzeMissingAwait(source, { file: "/test.ts" }).map(d => d.command),
                expected,
            ),
        );
    }
    for (const extension of [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]) {
        it(`should parse ${extension} and report CRLF/UTF8/end-of-file locations`, () => {
            const source = 'it("я", ({browser}) => {\r\n browser.assertView("я");\r\n});';
            const diagnostics = analyzeMissingAwait(source, { file: "/test" + extension });
            assert.include(diagnostics[0], { line: 2, column: 2, command: "assertView" });
        });
    }
    for (const [mochaUi, method] of [
        ["bdd", "beforeEach"],
        ["tdd", "setup"],
        ["qunit", "test"],
    ] as const) {
        it(`should recognize ${mochaUi} callbacks`, () => {
            assert.lengthOf(
                analyzeMissingAwait(`${method}("x", ({browser}) => { browser.url('/'); });`, {
                    file: "/test.js",
                    mochaUi,
                }),
                1,
            );
        });
    }
    it("should parse TypeScript assertions and decorators", () => {
        const source = "@dec class C {} it('x', ({browser}) => { const s = <string>name; browser.assertView(s); });";
        assert.lengthOf(analyzeMissingAwait(source, { file: "/test.ts" }), 1);
    });
    it("should parse JSX without executing it", () => {
        assert.lengthOf(
            analyzeMissingAwait("it('x', ({browser}) => { const el = <div/>; browser.assertView('x'); });", {
                file: "/test.tsx",
            }),
            1,
        );
    });
});

describe("missing await type information", function () {
    this.timeout(15000);
    let dir: string;
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "testplane-await-types-"));
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    const analyze = (source: string, extension = ".ts", config?: object): string[] => {
        const file = path.join(dir, "test" + extension);
        fs.writeFileSync(file, source);
        fs.writeFileSync(
            path.join(dir, "helper.d.ts"),
            "export declare function helper(): Promise<void>; export declare function sync(): void;\n",
        );
        if (config) fs.writeFileSync(path.join(dir, "tsconfig.json"), JSON.stringify(config));
        const sources = new Map([[file, source]]);
        const program = createTypeProgram([file], sources, config ? path.join(dir, "tsconfig.json") : undefined);
        return analyzeMissingAwait(source, { file, program }).map(d => d.command);
    };

    it("should not attribute a global helper body from another file to the selected source", () => {
        const file = path.join(dir, "test.js");
        const helper = path.join(dir, "global-helper.js");
        const source = "it('x', ({browser}) => { shared(browser); });";
        const sources = new Map([
            [file, source],
            [helper, "function shared(browser) { browser.assertView('elsewhere'); }"],
        ]);
        for (const [name, content] of sources) fs.writeFileSync(name, content);
        const config = path.join(dir, "tsconfig.json");
        fs.writeFileSync(config, JSON.stringify({ compilerOptions: { moduleDetection: "legacy" } }));
        const program = createTypeProgram([file, helper], sources, config);
        assert.deepEqual(analyzeMissingAwait(source, { file, program }), []);
    });
    for (const [body, expected] of reviewCases) {
        it(`should analyze review regression with production types: ${body}`, () => {
            assert.deepEqual(analyze(`it("x", async ({browser}) => { ${body} });`, ".js"), expected);
        });
    }
    it("should not mistake a non-callable then property for an async callback", () => {
        const source = "declare const cb: (n: number) => {then: string}; it('x', () => { [1].forEach(cb); });";
        assert.deepEqual(analyzeMissingAwait(source, { file: "/test.ts" }), []);
        assert.deepEqual(analyze(source), []);
    });
    it("should preserve a local helper's declared promise return type", () => {
        assert.deepEqual(
            analyze("function helper(): Promise<void> { return unknownConsumer(); } it('x', () => { helper(); });"),
            ["helper"],
        );
    });
    it("should preserve a known callback's declared promise return type", () => {
        assert.deepEqual(
            analyze("function cb(): Promise<void> { return unknownConsumer(); } it('x', () => { [1].forEach(cb); });"),
            ["forEach"],
        );
    });
    it("should detect an imported async helper without a tsconfig", () => {
        assert.deepEqual(analyze("import {helper, sync} from './helper'; it('x', () => { helper(); sync(); });"), [
            "helper",
        ]);
    });
    it("should track a saved imported helper promise through branches", () => {
        assert.deepEqual(
            analyze("import {helper} from './helper'; it('x', async () => { const p = helper(); if(flag) await p; });"),
            ["helper"],
        );
    });
    it("should accept an awaited imported async helper", () => {
        assert.deepEqual(analyze("import {helper} from './helper'; it('x', async () => { await helper(); });"), []);
    });
    it("should recognize an externally declared custom command", () => {
        assert.deepEqual(
            analyze(
                "interface Browser { custom(): PromiseLike<void>; } it('x', ({browser}: {browser: Browser}) => { browser.custom(); });",
            ),
            ["custom"],
        );
    });
    it("should resolve paths from an existing tsconfig", () => {
        assert.deepEqual(
            analyze("import {helper} from '@helpers'; it('x', () => { helper(); });", ".ts", {
                compilerOptions: { baseUrl: ".", paths: { "@helpers": ["./helper"] } },
            }),
            ["helper"],
        );
    });
    it("should use JS declarations and JSDoc too", () => {
        assert.deepEqual(
            analyze(
                "/** @returns {Promise<void>} */ function helper() { return Promise.resolve(); } it('x', () => { helper(); });",
                ".js",
            ),
            ["helper"],
        );
    });
    it("should identify a typed array and an imported async callback", () => {
        assert.deepEqual(
            analyze(
                "import {helper} from './helper'; declare const items: string[]; it('x', () => { items.forEach(helper); });",
            ),
            ["forEach"],
        );
    });
    it("should not treat any as proof of an async result", () => {
        assert.deepEqual(
            analyze("declare const unknownBrowser: any; it('x', () => { unknownBrowser.custom(); });"),
            [],
        );
    });
    it("should retain known commands even with missing types", () => {
        assert.deepEqual(analyze("it('x', ({browser}: any) => { browser.assertView('x'); });"), ["assertView"]);
    });
});
