import type {
    GlobalAfterEachType,
    GlobalBeforeEachType,
    GlobalDescribeType,
    GlobalHermioneType,
    GlobalItType,
    GlobalTestplaneType,
    TestplaneGlobals,
} from "./types/globals";

export const it: GlobalItType = (globalThis as unknown as TestplaneGlobals).it;
export const describe: GlobalDescribeType = (globalThis as unknown as TestplaneGlobals).describe;
export const beforeEach: GlobalBeforeEachType = (globalThis as unknown as TestplaneGlobals).beforeEach;
export const afterEach: GlobalAfterEachType = (globalThis as unknown as TestplaneGlobals).afterEach;
export const testplane: GlobalTestplaneType = (globalThis as unknown as TestplaneGlobals).testplane;
export const hermione: GlobalHermioneType = (globalThis as unknown as TestplaneGlobals).hermione;
