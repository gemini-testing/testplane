type TestDefinition = import("../build/src/test-reader/test-object/types").TestDefinition;
type SuiteDefinition = import("../build/src/test-reader/test-object/types").SuiteDefinition;
type TestHookDefinition = import("../build/src/test-reader/test-object/types").TestHookDefinition;

declare const it: TestDefinition;
declare const describe: SuiteDefinition;
declare const beforeEach: TestHookDefinition;
declare const afterEach: TestHookDefinition;
