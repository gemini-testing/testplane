import SkippedTestRunner from "./skipped-test-runner";
import InsistantTestRunner from "./insistant-test-runner";
import { Config } from "../../config";
import type { Test } from "../../types";
import type BrowserAgent from "../browser-agent";
export type TestRunner = SkippedTestRunner | InsistantTestRunner;
export declare const create: (test: Test, config: Config, browserAgent: BrowserAgent) => TestRunner;
