import SkippedTestRunner from "./skipped-test-runner.js";
import InsistantTestRunner from "./insistant-test-runner.js";
import { Config } from "../../config/index.js";
import type { Test } from "../../types/index.js";
import type BrowserAgent from "../browser-agent.js";

export type TestRunner = SkippedTestRunner | InsistantTestRunner;

export const create = function (test: Test, config: Config, browserAgent: BrowserAgent): TestRunner {
    return test.pending || test.disabled
        ? SkippedTestRunner.create(test)
        : InsistantTestRunner.create(test, config, browserAgent);
};
