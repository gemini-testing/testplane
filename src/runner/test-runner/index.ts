import SkippedTestRunner from "./skipped-test-runner";
import InsistantTestRunner from "./insistant-test-runner";
import { Config } from "../../config";
import type { Test } from "../../types";
import type BrowserAgent from "../browser-agent";

export type TestRunner = SkippedTestRunner | InsistantTestRunner;

export const create = function (test: Test, config: Config, browserAgent: BrowserAgent): TestRunner {
    return test.pending || test.disabled
        ? SkippedTestRunner.create(test)
        : InsistantTestRunner.create(test, config, browserAgent);
};
