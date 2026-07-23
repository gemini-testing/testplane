import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import sinon, { type SinonStub } from "sinon";

import { ProfilerManager } from "src/profiler/manager";
import { BootstrapProbe } from "src/profiler/runtime/bootstrap-probe";
import type { Config } from "src/config";
import type { ProfilerConsole } from "src/profiler/output/console";
import type { EnabledProfilerLevel, ProfilerResultV1 } from "src/profiler/schema";

describe("profiler/manager", () => {
    const sandbox = sinon.createSandbox();
    let tempDir: string;

    const makeConfig = ({
        level = 1,
        output = null,
    }: { level?: 0 | EnabledProfilerLevel; output?: string | null } = {}): Config =>
        ({
            profiler: { level, output },
            system: { workers: 2 },
            getBrowserIds: () => ["chrome"],
            forBrowser: () => ({ sessionsPerBrowser: 3 }),
        } as unknown as Config);

    const makeOutput = (): ProfilerConsole & { log: SinonStub; warn: SinonStub } => ({
        log: sandbox.stub(),
        warn: sandbox.stub(),
    });

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "testplane-profiler-"));
    });

    afterEach(async () => {
        sandbox.restore();
        await fs.remove(tempDir);
    });

    it("should emit and write the same immutable versioned result", async () => {
        const outputPath = path.join(tempDir, "profile.json");
        const manager = new ProfilerManager(makeConfig({ level: 2, output: outputPath }), new BootstrapProbe(), {
            output: makeOutput(),
        });
        let emitted: Readonly<ProfilerResultV1> | undefined;
        manager.setResultEmitter(result => {
            emitted = result;
        });

        const value = await manager.profileOperation("api", async () => {
            await manager.runtime.withSpan("testplane.phase.example", { name: "Example" }, async () => undefined);
            return 42;
        });

        const fromFile = await fs.readJson(outputPath);
        assert.equal(value, 42);
        assert.strictEqual(emitted, manager.lastResult);
        assert.deepEqual(fromFile, emitted);
        assert.equal(emitted!.schemaVersion, 1);
        assert.equal(emitted!.run.profileStatus, "complete");
        assert.isTrue(Object.isFrozen(emitted!));
        assert.isTrue(Object.isFrozen(emitted!.timeline));
    });

    it("should keep an explicitly supplied distributed run id only once in the public result", async () => {
        const manager = new ProfilerManager(makeConfig(), new BootstrapProbe(), {
            output: makeOutput(),
            runId: "master-run-id",
            process: { type: "worker", pid: 42, workerInstanceId: "worker-1" },
        });

        await manager.profileOperation("api", () => {
            manager.runtime.recordMeasurement("test.body", 1, { parentId: "missing-parent" });
        });

        const result = manager.lastResult!;
        assert.equal(result.run.id, "master-run-id");
        assert.lengthOf(JSON.stringify(result).match(/master-run-id/g) ?? [], 1);
        assert.isNotEmpty(result.profiler.collectionErrors);
        assert.isTrue(result.timeline.every(item => !("runId" in item.context)));
        assert.isTrue(result.timeline.every(item => /^op:[0-9a-z]+$/.test(item.id)));
        assert.equal(result.timeline.find(item => item.kind === "testplane.operation")!.id, "op:0");
    });

    it("should not expose artifacts when level is zero", async () => {
        const output = makeOutput();
        const manager = new ProfilerManager(makeConfig({ level: 0 }), new BootstrapProbe(), { output });
        const emitResult = sandbox.stub();
        manager.setResultEmitter(emitResult);

        assert.equal(await manager.profileOperation("api", () => "ok"), "ok");
        assert.isUndefined(manager.lastResult);
        assert.notCalled(emitResult);
        assert.notCalled(output.log);
        assert.notCalled(output.warn);
    });

    it("should preserve the operation error and create a partial result", async () => {
        const manager = new ProfilerManager(makeConfig(), new BootstrapProbe(), { output: makeOutput() });
        const error = new Error("operation failed");

        await assert.isRejected(
            manager.profileOperation("api", () => Promise.reject(error)),
            error.message,
        );

        assert.equal(manager.lastResult!.run.runOutcome, "aborted");
        assert.equal(manager.lastResult!.run.profileStatus, "partial");
        assert.equal(manager.lastResult!.run.partialReasons[0].code, "OPERATION_ERROR");
    });

    it("should not change the operation result when output channels fail", async () => {
        const blocker = path.join(tempDir, "blocker");
        await fs.writeFile(blocker, "not a directory");
        const output = makeOutput();
        const manager = new ProfilerManager(
            makeConfig({ output: path.join(blocker, "profile.json") }),
            new BootstrapProbe(),
            { output },
        );
        manager.setResultEmitter(() => Promise.reject(new Error("event failed")));

        assert.equal(await manager.profileOperation("api", () => "passed"), "passed");
        assert.equal(manager.lastResult!.run.runOutcome, "passed");
        assert.equal(output.warn.callCount, 2);
    });

    it("should let result handlers run nested operations without reentering finalization", async () => {
        const manager = new ProfilerManager(makeConfig(), new BootstrapProbe(), { output: makeOutput() });
        const nestedAction = sandbox.stub().resolves("nested");
        const emitResult = sandbox.stub().callsFake(() => manager.profileOperation("readTests", nestedAction));
        manager.setResultEmitter(emitResult);

        assert.equal(await manager.profileOperation("api", () => "outer"), "outer");

        assert.calledOnce(emitResult);
        assert.calledOnce(nestedAction);
        assert.equal(manager.lastResult!.run.operation, "api");
        assert.equal(manager.runtime.level, 0);
    });

    it("should finalize an aborted operation once and retain the termination reason", async () => {
        const manager = new ProfilerManager(makeConfig(), new BootstrapProbe(), { output: makeOutput() });
        let release!: (value: boolean) => void;
        const operation = manager.profileOperation(
            "run",
            () =>
                new Promise(resolve => {
                    release = resolve;
                }),
        );

        manager.abort({ code: "SIGNAL", message: "SIGTERM" });
        const first = await manager.finalize();
        const second = await manager.finalize();
        release(true);
        await operation;

        assert.strictEqual(first, second);
        assert.equal(first!.run.runOutcome, "aborted");
        assert.equal(first!.run.profileStatus, "partial");
        assert.deepInclude(first!.run.partialReasons[0], { code: "SIGNAL", message: "SIGTERM" });
    });

    it("should serialize concurrent finalize calls to a single result", async () => {
        const emitResult = sandbox.stub();
        const manager = new ProfilerManager(makeConfig(), new BootstrapProbe(), { output: makeOutput() });
        manager.setResultEmitter(emitResult);
        let release!: (value: boolean) => void;
        const operation = manager.profileOperation(
            "run",
            () =>
                new Promise(resolve => {
                    release = resolve;
                }),
        );

        manager.abort({ code: "SIGNAL", message: "SIGINT" });
        const [first, second] = await Promise.all([manager.finalize(), manager.finalize()]);
        release(true);
        await operation;

        assert.strictEqual(first, second);
        assert.equal(emitResult.callCount, 1);
        assert.equal(first!.run.runOutcome, "aborted");
        assert.deepInclude(first!.run.partialReasons[0], { code: "SIGNAL", message: "SIGINT" });
    });
});
