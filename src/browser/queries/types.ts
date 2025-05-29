import {
    Config as BaseConfig,
    BoundFunction as BoundFunctionBase,
    queries,
    waitForOptions,
    SelectorMatcherOptions,
    MatcherOptions,
} from "@testing-library/dom";
import { SelectorsBase } from "./wdio-types.js";

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

export type WebdriverIOQueryReturnType<Element, ElementArray, T> = T extends Promise<HTMLElement>
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

export type WebdriverIOBoundFunction<Element, ElementArray, T> = (
    ...params: Parameters<BoundFunctionBase<T>>
) => Promise<WebdriverIOQueryReturnType<Element, ElementArray, ReturnType<BoundFunctionBase<T>>>>;

export type WebdriverIOBoundFunctionSync<Element, ElementArray, T> = (
    ...params: Parameters<BoundFunctionBase<T>>
) => WebdriverIOQueryReturnType<Element, ElementArray, ReturnType<BoundFunctionBase<T>>>;

export type WebdriverIOQueries = {
    [P in keyof Queries]: WebdriverIOBoundFunction<WebdriverIO.Element, WebdriverIO.Element[], Queries[P]>;
};

export type WebdriverIOQueriesSync = {
    [P in keyof Queries]: WebdriverIOBoundFunctionSync<WebdriverIO.Element, WebdriverIO.Element[], Queries[P]>;
};

export type WebdriverIOQueriesChainable<Container extends SelectorsBase | undefined> = {
    [P in keyof Queries as `${string & P}$`]: Container extends SelectorsBase
        ? WebdriverIOBoundFunctionSync<ReturnType<Container["$"]>, ReturnType<Container["$$"]>, Queries[P]>
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
