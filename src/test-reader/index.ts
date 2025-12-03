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

export type TestReaderOpts = { paths: string[] } & Partial<ReadTestsOpts>;

export class TestReader extends EventEmitter {
    #config;

    static create<T extends TestReader>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this: new (...args: any[]) => T,
        ...args: ConstructorParameters<typeof TestReader>
    ): T {
        return new this(...args);
    }

    constructor(config: Config) {
        super();

        this.#config = config;
    }

    async read(options: TestReaderOpts): Promise<Record<string, Test[]>> {
        const { paths, browsers, ignore, sets, grep, tag, runnableOpts } = options;

        const { fileExtensions } = this.#config.system;
        const envSets = env.parseCommaSeparatedValue(["TESTPLANE_SETS", "HERMIONE_SETS"]).value;
        const setCollection = await SetsBuilder.create(this.#config.sets, { defaultPaths: ["testplane", "hermione"] })
            .useFiles(paths)
            .useSets((sets || []).concat(envSets))
            .useBrowsers(browsers!)
            .build(process.cwd(), { ignore }, fileExtensions);

        const parser = new TestParser();
        passthroughEvent(parser, this, [MasterEvents.BEFORE_FILE_READ, MasterEvents.AFTER_FILE_READ]);

        await parser.loadFiles(setCollection.getAllFiles(), { config: this.#config, runnableOpts });

        const filesByBro = setCollection.groupByBrowser();
        const testsByBro = _.mapValues(filesByBro, (files, browserId) =>
            parser.parse(files, { browserId, config: this.#config.forBrowser(browserId), grep, tag }),
        );

        validateTests(testsByBro, options, this.#config);

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
