import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { strict as assert } from "node:assert";
import sinon from "sinon";

import Testplane, { type ConfigInput, type ProfilerResultV1 } from "../../../src";
import { MasterEvents } from "../../../src/events";

describe("profiler integration", () => {
    const fixture = path.join(__dirname, "fixtures/simple.testplane.ts");
    let temporaryDirectory: string;

    beforeEach(async () => {
        temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "testplane-profiler-integration-"));
    });

    afterEach(async () => {
        sinon.restore();
        await fs.rm(temporaryDirectory, { recursive: true, force: true });
    });

    it("delivers one immutable canonical result to the event and JSON", async () => {
        const output = path.join(temporaryDirectory, "profile.json");
        const testplane = await Testplane.create(makeConfig(2, output));
        let eventResult: Readonly<ProfilerResultV1> | undefined;
        testplane.on(MasterEvents.PROFILER_RESULT, async result => {
            await Promise.resolve();
            eventResult = result;
        });

        const collection = await testplane.readTests([fixture]);
        const jsonResult = JSON.parse(await fs.readFile(output, "utf8")) as ProfilerResultV1;

        assert.equal(collection.mapTests(test => test).length, 1);
        assert.ok(eventResult);
        assert.equal(eventResult.run.operation, "readTests");
        assert.equal(eventResult.run.profileStatus, "complete");
        assert.equal(eventResult.schemaVersion, 1);
        assert.ok(Object.isFrozen(eventResult));
        assert.deepEqual(jsonResult, eventResult);
        assert.equal(JSON.stringify(eventResult).split(eventResult.run.id).length - 1, 1);
        assert.ok(eventResult.timeline.every(operation => !("runId" in operation.context)));
        assert.ok(eventResult.timeline.every(operation => /^op:[0-9a-z]+$/.test(operation.id)));
        assert.ok(eventResult.timeline.some(operation => operation.kind === "testplane.phase.test-discovery"));
        assert.ok(eventResult.timeline.some(operation => operation.kind === "test.file.load"));
        assert.equal(eventResult.timeline.find(operation => operation.kind === "files.load")?.attributes.files, 1);
        assert.equal(
            eventResult.aggregates.testFiles.find(
                aggregate => aggregate.kind === "test.file.load.summary" && aggregate.attributes?.process === "master",
            )?.count,
            1,
        );
    });

    it("keeps level zero silent and artifact-free", async () => {
        const output = path.join(temporaryDirectory, "disabled.json");
        const testplane = await Testplane.create(makeConfig(0, output));
        const listener = sinon.spy();
        const log = sinon.spy(console, "log");
        const warn = sinon.spy(console, "warn");
        testplane.on(MasterEvents.PROFILER_RESULT, listener);

        await testplane.readTests([fixture]);

        assert.equal(await exists(output), false);
        assert.equal(listener.callCount, 0);
        assert.equal(log.args.flat().filter(value => String(value).startsWith("[profiler]")).length, 0);
        assert.equal(warn.args.flat().filter(value => String(value).startsWith("[profiler]")).length, 0);
    });

    it("makes each enabled level a superset of the previous data classes", async () => {
        const classesByLevel: string[][] = [];
        for (const level of [1, 2, 3] as const) {
            const testplane = await Testplane.create(makeConfig(level));
            let result: Readonly<ProfilerResultV1> | undefined;
            testplane.on(MasterEvents.PROFILER_RESULT, value => {
                result = value;
            });

            await testplane.readTests([fixture]);
            assert.ok(result);
            classesByLevel.push(
                result.dataQuality.coverage
                    .filter(entry => entry.status !== "unavailable")
                    .map(entry => entry.collector),
            );
        }

        for (const collector of classesByLevel[0]) {
            assert.ok(classesByLevel[1].includes(collector));
            assert.ok(classesByLevel[2].includes(collector));
        }
        for (const collector of classesByLevel[1]) {
            assert.ok(classesByLevel[2].includes(collector));
        }
    });

    it("correlates a slow async INIT listener with a slow file dependency at level three", async () => {
        const dependency = path.join(temporaryDirectory, "slow-dependency.js");
        const testFile = path.join(temporaryDirectory, "profiled.testplane.js");
        await fs.writeFile(
            dependency,
            "const end = Date.now() + 300; while (Date.now() < end) {} module.exports = true;\n",
        );
        await fs.writeFile(
            testFile,
            'require("./slow-dependency"); describe("profiled", () => it("works", () => undefined));\n',
        );

        const testplane = await Testplane.create(makeConfig(3));
        async function slowInitHandler(): Promise<void> {
            await new Promise(resolve => setTimeout(resolve, 120));
        }
        testplane.on(MasterEvents.INIT, slowInitHandler);
        let result: Readonly<ProfilerResultV1> | undefined;
        testplane.on(MasterEvents.PROFILER_RESULT, value => {
            result = value;
        });

        await testplane.readTests([testFile]);

        assert.ok(result);
        const listener = result.timeline.find(
            operation => operation.kind === "event.listener" && operation.name.endsWith(":slowInitHandler"),
        );
        assert.ok(listener);
        assert.equal(listener.attributes.origin, "user");
        assert.match(listener.source?.file ?? "", /profiler\.test\.ts$/);
        assert.ok((listener.timing.waitingMs ?? 0) > (listener.timing.activeJsMs ?? 0));
        assert.ok(
            result.timeline.some(
                operation =>
                    operation.kind === "module.load" &&
                    operation.name.endsWith("slow-dependency.js") &&
                    operation.attributes.cacheHit === false,
            ),
        );
        assert.ok(result.findings.some(finding => finding.analyzer.id === "test-file-v1"));
        const moduleFindings = result.findings.filter(finding => finding.analyzer.id === "module-dependency-v1");
        assert.ok(moduleFindings.some(finding => finding.observation.includes("slow-dependency.js")));
        assert.ok(moduleFindings.every(finding => !finding.observation.includes("profiled.testplane.js")));
    });
});

function makeConfig(level: 0 | 1 | 2 | 3, output: string | null = null): ConfigInput {
    return {
        profiler: { level, output },
        browsers: {
            chrome: {
                desiredCapabilities: { browserName: "chrome" },
            },
        },
    };
}

async function exists(file: string): Promise<boolean> {
    try {
        await fs.access(file);
        return true;
    } catch {
        return false;
    }
}
