import type {
    GlobalAfterEachType,
    GlobalBeforeEachType,
    GlobalDescribeType,
    GlobalHermioneType,
    GlobalItType,
    GlobalTestplaneType,
    TestplaneGlobals,
} from "./types/globals";

const typedGlobals = globalThis as unknown as TestplaneGlobals;

function itFunc(this: unknown, ...args: Parameters<GlobalItType>): ReturnType<GlobalItType> {
    return typedGlobals.it.apply(this, args);
}

itFunc.only = function (this: unknown, ...args: Parameters<GlobalItType["only"]>): ReturnType<GlobalItType["only"]> {
    return typedGlobals.it.only.apply(this, args);
};

itFunc.skip = function (this: unknown, ...args: Parameters<GlobalItType["skip"]>): ReturnType<GlobalItType["skip"]> {
    return typedGlobals.it.skip.apply(this, args);
};

function describeFunc(this: unknown, ...args: Parameters<GlobalDescribeType>): ReturnType<GlobalDescribeType> {
    return typedGlobals.describe.apply(this, args);
}

describeFunc.only = function (
    this: unknown,
    ...args: Parameters<GlobalDescribeType["only"]>
): ReturnType<GlobalDescribeType["only"]> {
    return typedGlobals.describe.only.apply(this, args);
};

describeFunc.skip = function (
    this: unknown,
    ...args: Parameters<GlobalDescribeType["skip"]>
): ReturnType<GlobalDescribeType["skip"]> {
    return typedGlobals.describe.skip.apply(this, args);
};

function beforeEachFunc(this: unknown, ...args: Parameters<GlobalBeforeEachType>): ReturnType<GlobalBeforeEachType> {
    return typedGlobals.beforeEach.apply(this, args);
}

function afterEachFunc(this: unknown, ...args: Parameters<GlobalAfterEachType>): ReturnType<GlobalAfterEachType> {
    return typedGlobals.afterEach.apply(this, args);
}

const testplaneProxy = new Proxy(
    {},
    {
        get(_, prop: keyof GlobalTestplaneType): GlobalTestplaneType[keyof GlobalTestplaneType] {
            return typedGlobals.testplane[prop];
        },
    },
);

export const it = itFunc as GlobalItType;
export const describe = describeFunc as GlobalDescribeType;
export const beforeEach = beforeEachFunc as GlobalBeforeEachType;
export const afterEach = afterEachFunc as GlobalAfterEachType;
export const testplane = testplaneProxy as GlobalTestplaneType;
export const hermione = testplaneProxy as GlobalHermioneType;
