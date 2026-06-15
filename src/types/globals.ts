import type { GlobalHelper } from ".";
import type { SuiteDefinition, TestDefinition, TestHookDefinition } from "../test-reader/test-object/types";

export type GlobalItType = TestDefinition;
export type GlobalDescribeType = SuiteDefinition;
export type GlobalBeforeEachType = TestHookDefinition;
export type GlobalAfterEachType = TestHookDefinition;
export type GlobalTestplaneType = GlobalHelper;
export type GlobalHermioneType = GlobalHelper;

export type TestplaneGlobals = {
    it: GlobalItType;
    describe: GlobalDescribeType;
    beforeEach: GlobalBeforeEachType;
    afterEach: GlobalAfterEachType;
    testplane: GlobalTestplaneType;
    hermione: GlobalHermioneType;
};
