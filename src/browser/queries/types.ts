import {
    Config as BaseConfig,
    BoundFunction as BoundFunctionBase,
    queries,
    waitForOptions,
    SelectorMatcherOptions,
    MatcherOptions,
} from "@testing-library/dom";

export type SelectorsBase = Pick<WebdriverIO.Browser, "$" | "$$">;

export type Queries = typeof queries;
export type QueryName = keyof Queries;

export type Config = Pick<
    BaseConfig,
    | "asyncUtilTimeout"
    | "computedStyleSupportsPseudoElements"
    | "defaultHidden"
    | "testIdAttribute"
    | "throwSuggestions"
>;

export type QueryReturnType<Element, ElementArray, T> = T extends Promise<HTMLElement>
    ? Element
    : T extends HTMLElement
    ? Element
    : T extends Promise<HTMLElement[]>
    ? ElementArray
    : T extends HTMLElement[]
    ? ElementArray
    : T extends null
    ? null
    : never;

export type BoundFunction<Element, ElementArray, T> = (
    ...params: Parameters<BoundFunctionBase<T>>
) => Promise<QueryReturnType<Element, ElementArray, ReturnType<BoundFunctionBase<T>>>>;

export type BoundFunctionSync<Element, ElementArray, T> = (
    ...params: Parameters<BoundFunctionBase<T>>
) => QueryReturnType<Element, ElementArray, ReturnType<BoundFunctionBase<T>>>;

export type TestplaneQueries = {
    [P in keyof Queries]: BoundFunction<WebdriverIO.Element, WebdriverIO.Element[], Queries[P]>;
};

export type TestplaneQueriesChainable<Container extends SelectorsBase | undefined = SelectorsBase> = {
    [P in keyof Queries as `${string & P}$`]: Container extends SelectorsBase
        ? BoundFunctionSync<ReturnType<Container["$"]>, ReturnType<Container["$$"]>, Queries[P]>
        : undefined;
};

export type ObjectQueryArg = MatcherOptions | queries.ByRoleOptions | SelectorMatcherOptions | waitForOptions;

export type QueryArg = ObjectQueryArg | RegExp | number | string | undefined;

export type SerializedObject = {
    serialized: "object";
    // eslint-disable-next-line no-use-before-define
    [key: string]: SerializedArg;
};
export type SerializedRegExp = { serialized: "RegExp"; RegExp: string };
export type SerializedUndefined = { serialized: "Undefined"; Undefined: true };

export type SerializedArg = SerializedObject | SerializedRegExp | SerializedUndefined | number | string;

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace WebdriverIO {
        interface Element extends TestplaneQueries {}
    }
}
