"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

async function measure(count, browsers) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "testplane-preflight-bench-"));
    const analyzer = require("../build/src/test-reader/await-check/analyze");
    const analyze = analyzer.analyzeMissingAwait;
    let analyses = 0;
    analyzer.analyzeMissingAwait = (...args) => {
        analyses++;
        return analyze(...args);
    };
    const { validateTestCollection } = require("../build/src/test-reader/await-check");
    const { Test } = require("../build/src/test-reader/test-object");
    const { TestCollection } = require("../build/src/test-collection");
    try {
        const files = Array.from({ length: count }, (_, i) => path.join(dir, i + ".js"));
        await Promise.all(
            files.map((file, i) =>
                fs.writeFile(file, `it("test${i}", async ({browser}) => { await browser.assertView("plane"); });\n`),
            ),
        );
        const specs = Object.fromEntries(
            Array.from({ length: browsers }, (_, b) => [
                String(b),
                files.map((file, i) =>
                    Test.create({
                        title: String(i),
                        file,
                        id: String(i),
                        location: undefined,
                        fn() {},
                    }),
                ),
            ]),
        );
        const start = performance.now();
        await validateTestCollection(TestCollection.create(specs));
        assert.equal(analyses, count);
        return { ms: performance.now() - start, peakRssKb: process.resourceUsage().maxRSS, analyses };
    } finally {
        analyzer.analyzeMissingAwait = analyze;
        await fs.rm(dir, { recursive: true, force: true });
    }
}

async function main() {
    if (process.argv[2] === "--child") {
        console.log(JSON.stringify(await measure(Number(process.argv[3]), Number(process.argv[4]))));
        return;
    }
    for (const files of [100, 1000]) {
        for (const browsers of [1, 3]) {
            const samples = Array.from({ length: 5 }, () =>
                JSON.parse(
                    execFileSync(process.execPath, [__filename, "--child", String(files), String(browsers)], {
                        encoding: "utf8",
                    }),
                ),
            );
            console.log(
                JSON.stringify({
                    files,
                    browsers,
                    medianMs: samples.map(s => s.ms).sort((a, b) => a - b)[2],
                    peakRssKb: Math.max(...samples.map(s => s.peakRssKb)),
                    selectedFileAnalyses: samples[0].analyses,
                }),
            );
        }
    }
}
main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
