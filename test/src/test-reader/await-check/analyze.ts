import { analyzeMissingAwait } from "../../../../src/test-reader/await-check/analyze";

describe("missing await analyzer", () => {
    const analyze = (body: string): string[] =>
        analyzeMissingAwait(`it("test", async function ({browser}) { ${body} });`, { file: "/test.js" }).map(
            d => d.command,
        );

    [
        ["bare command", "browser.assertView('plane');", ["assertView"]],
        ["non-await chain", "browser.$('a').click();", ["click"]],
        ["saved promise", "const p = browser.assertView('plane');", ["assertView"]],
        ["alias forgotten", "const p = browser.url('/'); const q = p;", ["url"]],
        ["await only in one branch", "const p = browser.url('/'); if (flag) await p;", ["url"]],
        ["early return", "const p = browser.url('/'); if (flag) return; await p;", ["url"]],
        ["ignored catch", "browser.url('/').catch(() => {});", ["catch"]],
        ["void", "void browser.assertView('plane');", ["assertView"]],
        ["ignored aggregate", "Promise.all([browser.url('/'), browser.assertView('plane')]);", ["Promise.all"]],
        ["sequence prefix", "await (browser.url('/'), browser.assertView('plane'));", ["url"]],
        ["callback body", "await browser.runStep('step', () => { browser.assertView('plane'); });", ["assertView"]],
        ["async forEach", "['a'].forEach(async x => { await browser.assertView(x); });", ["forEach"]],
        ["awaited forEach", "await ['a'].forEach(async x => { await browser.assertView(x); });", ["forEach"]],
        ["lost map", "['a'].map(async x => { await browser.assertView(x); });", ["map"]],
        ["awaited array", "await ['a'].map(async x => { await browser.assertView(x); });", ["map"]],
        ["saved array", "const ps = [browser.url('/')];", ["url"]],
    ].forEach(([name, body, expected]) => {
        it(`should report ${name}`, () => assert.deepEqual(analyze(body as string), expected));
    });

    [
        "await browser.assertView('plane');",
        "return browser.assertView('plane');",
        "const p = browser.url('/'); await p;",
        "const p = browser.url('/'); const q = p; await q;",
        "const p = browser.url('/'); if (flag) await p; else await p;",
        "const p = browser.url('/'); if (flag) return p; await p;",
        "const p = browser.url('/'); try { if (flag) return; } finally { await p; }",
        "const ps = [browser.url('/'), browser.assertView('plane')]; await Promise.all(ps);",
        "await Promise.all(['a'].map(async x => { await browser.assertView(x); }));",
        "const bro = browser; const el = await bro.$('a'); await el.click();",
        "browser.addCommand('foo', async () => {}); await browser.foo();",
        "browser.action('pointer').move({x: 0, y: 0});",
        "await browser.action('pointer').move({x: 0, y: 0}).perform();",
        "await browser.execute(() => { browser.assertView('client'); });",
        "console.log('x');",
        "const p = browser.url('/'); unknownConsumer(p);",
    ].forEach(body => {
        it(`should accept ${body}`, () => assert.deepEqual(analyze(body), []));
    });

    it("should not confuse a local object with a browser", () => {
        assert.deepEqual(
            analyzeMissingAwait("it('x', () => { const browser = {assertView() {}}; browser.assertView('x'); });", {
                file: "/test.js",
            }),
            [],
        );
    });

    it("should report original one-based coordinates without executing the source", () => {
        const source =
            'it("x", async ({ browser }) => {\n  throw new Error("must not execute");\n  browser.assertView("plane");\n});';
        // A separate reachable body demonstrates source coordinates; the analyzer must never execute either body.
        const diagnostics = analyzeMissingAwait(
            source.replace('throw new Error("must not execute");', "sideEffect();"),
            { file: "/test.ts" },
        );
        assert.include(diagnostics[0], { file: "/test.ts", line: 3, column: 3, command: "assertView" });
    });
});
