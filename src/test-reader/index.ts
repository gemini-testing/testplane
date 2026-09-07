import _ from "lodash";
import { EventEmitter } from "events";
import { passthroughEvent } from "../events/utils";
import { SetsBuilder } from "./sets-builder";
import { TestParser } from "./test-parser";
import { MasterEvents } from "../events";
import env from "../utils/env";
import type { Config } from "../config";
import type { Test } from "./test-object";
import type { ReadTestsOpts } from "../testplane";
import { noopProfilerRuntime } from "../profiler/runtime/noop";
import type { ProfilerRuntimeLike } from "../profiler/runtime/types";

export type TestReaderOpts = { paths: string[] } & Partial<ReadTestsOpts>;

export class TestReader extends EventEmitter {
    #config;
    #profiler;

    static create<T extends TestReader>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this: new (...args: any[]) => T,
        ...args: ConstructorParameters<typeof TestReader>
    ): T {
        return new this(...args);
    }

    constructor(config: Config, profiler: ProfilerRuntimeLike = noopProfilerRuntime) {
        super();

        this.#config = config;
        this.#profiler = profiler;
    }

    async read(options: TestReaderOpts): Promise<Record<string, Test[]>> {
        const { paths, browsers, ignore, sets, grep, tag, runnableOpts } = options;

        const { fileExtensions } = this.#config.system;
        const envSets = env.parseCommaSeparatedValue(["TESTPLANE_SETS", "HERMIONE_SETS"]).value;
        const setCollection = await this.#profiler.withSpan(
            "sets.resolve-and-glob",
            { minLevel: 1, name: "Resolve sets and find test files" },
            () =>
                SetsBuilder.create(this.#config.sets, { defaultPaths: ["testplane", "hermione"] })
                    .useFiles(paths)
                    .useSets((sets || []).concat(envSets))
                    .useBrowsers(browsers!)
                    .build(process.cwd(), { ignore }, fileExtensions),
        );

        const parser = new TestParser(this.#profiler);
        passthroughEvent(parser, this, [MasterEvents.BEFORE_FILE_READ, MasterEvents.AFTER_FILE_READ]);

        const testFiles = setCollection.getAllFiles();
        await this.#profiler.withSpan(
            "files.load",
            { minLevel: 1, name: "Load test files", attributes: { files: testFiles.length } },
            () => parser.loadFiles(testFiles, { config: this.#config, runnableOpts }),
        );

        const filesByBro = this.#profiler.withSpan(
            "files.group-by-browser",
            { minLevel: 1, name: "Group test files by browser" },
            () => setCollection.groupByBrowser(),
        );
        const testsByBro = _.mapValues(filesByBro, (files, browserId) =>
            this.#profiler.withSpan(
                "tests.parse",
                {
                    minLevel: 1,
                    name: browserId,
                    context: { browserId },
                    attributes: { browserId, files: files.length },
                },
                () => parser.parse(files, { browserId, config: this.#config.forBrowser(browserId), grep, tag }),
            ),
        );

        this.#profiler.withSpan("tests.validate", { minLevel: 1, name: "Validate tests" }, () =>
            validateTests(testsByBro, options, this.#config),
        );

        return testsByBro;
    }
}

function validateTests(testsByBro: Record<string, Test[]>, options: TestReaderOpts, config: Config): void {
    const tests = _.flatten(Object.values(testsByBro));

    const singleTestModes = [
        { condition: options.replMode?.enabled, name: "repl mode" },
        { condition: options.keepBrowserMode?.enabled, name: "keep-browser mode" },
    ].filter(mode => mode.condition);

    for (const mode of singleTestModes) {
        const testsToRun = tests.filter(test => !test.disabled && !test.pending);
        const browsersToRun = _.uniq(testsToRun.map(test => test.browserId));

        if (testsToRun.length !== 1) {
            throw new Error(
                `In ${mode.name} only 1 test in 1 browser should be run, but found ${testsToRun.length} tests` +
                    `${testsToRun.length === 0 ? ". " : ` that run in ${browsersToRun.join(", ")} browsers. `}` +
                    `Try to specify cli-options: "--grep" and "--browser" or use "testplane.only.in" in the test file.`,
            );
        }
    }

    if ((!_.isEmpty(tests) && tests.some(test => !test.silentSkip)) || (_.isEmpty(tests) && config.lastFailed.only)) {
        return;
    }

    const stringifiedOpts = convertOptions(_.omit(options, "replMode", "keepBrowserMode"));
    if (_.isEmpty(stringifiedOpts)) {
        throw new Error(`There are no tests found. Try to specify [${Object.keys(options).join(", ")}] options`);
    } else {
        throw new Error(`There are no tests found by the specified options:\n${stringifiedOpts}`);
    }
}

function convertOptions(obj: Record<string, unknown>): string {
    let result = "";
    for (const key of _.keys(obj)) {
        if (!_.isEmpty(obj[key]) || obj[key] instanceof RegExp) {
            if (_.isArray(obj[key])) {
                result += `- ${key}: ${(obj[key] as string[]).join(", ")}\n`;
            } else {
                result += `- ${key}: ${obj[key]}\n`;
            }
        }
    }
    return result;
}
