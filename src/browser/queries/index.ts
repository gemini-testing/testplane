import path from "path";
import fs from "fs";
import {
    Matcher,
    MatcherOptions,
    queries as baseQueries,
    waitForOptions as WaitForOptions,
} from "@testing-library/dom";

import { BaseWithExecute, BrowserBase, ElementBase } from "./wdio-types.js";
import {
    QueryArg,
    Config,
    QueryName,
    WebdriverIOQueries,
    WebdriverIOQueriesChainable,
    ObjectQueryArg,
    SerializedObject,
    SerializedArg,
} from "./types.js";

declare global {
    interface Window {
        TestingLibraryDom: typeof baseQueries & {
            configure: typeof configure;
        };
    }
}

/*
eslint-disable
@typescript-eslint/explicit-function-return-type
*/

const DOM_TESTING_LIBRARY_UMD_PATH = path.join(
    require.resolve("@testing-library/dom"),
    "../../",
    "dist/@testing-library/dom.umd.js",
);
const DOM_TESTING_LIBRARY_UMD = fs.readFileSync(DOM_TESTING_LIBRARY_UMD_PATH).toString().replace("define.amd", "false");

let _config: Partial<Config>;

function isContainerWithExecute(container: ElementBase | BaseWithExecute): container is BaseWithExecute {
    return (container as { execute?: unknown }).execute !== null;
}

function findContainerWithExecute(container: ElementBase): BaseWithExecute {
    let curContainer: ElementBase | BaseWithExecute = container.parent;
    while (!isContainerWithExecute(curContainer)) {
        curContainer = curContainer.parent;
    }
    return curContainer;
}

async function injectDOMTestingLibrary(container: ElementBase) {
    const containerWithExecute = findContainerWithExecute(container);
    const shouldInjectDTL = await containerWithExecute.execute(function () {
        return !window.TestingLibraryDom;
    });

    if (shouldInjectDTL) {
        await containerWithExecute.execute(function (library) {
            // add DOM Testing Library to page as a script tag to support Firefox
            if (navigator.userAgent.indexOf("Firefox") !== -1) {
                const script = window.document.createElement("script");
                script.textContent = library;
                window.document.head.append(script);
            } else {
                eval(library);
            }
        }, DOM_TESTING_LIBRARY_UMD);
    }

    await containerWithExecute.execute(function (config: Config) {
        window.TestingLibraryDom.configure(config);
    }, _config);
}

function serializeObject(object: ObjectQueryArg): SerializedObject {
    return Object.entries(object)
        .map<[string, SerializedArg]>(([key, value]: [string, QueryArg]) => [key, serializeArg(value)])
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {
            serialized: "object",
        });
}

function serializeArg(arg: QueryArg): SerializedArg {
    if (arg instanceof RegExp) {
        return { serialized: "RegExp", RegExp: arg.toString() };
    }
    if (typeof arg === "undefined") {
        return { serialized: "Undefined", Undefined: true };
    }
    if (arg && typeof arg === "object") {
        return serializeObject(arg);
    }
    return arg;
}

type SerializedQueryResult = { selector: string }[] | string | { selector: string } | null;

async function executeQuery(query: QueryName, container: HTMLElement, ...args: SerializedArg[]) {
    const done = args.pop() as unknown as (result: SerializedQueryResult) => void;

    function deserializeObject(object: SerializedObject) {
        return Object.entries(object)
            .map<[string, QueryArg]>(([key, value]) => [key, deserializeArg(value)])
            .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
    }

    function deserializeArg(arg: SerializedArg): QueryArg {
        if (typeof arg === "object" && arg.serialized === "RegExp") {
            return eval(arg.RegExp);
        }
        if (typeof arg === "object" && arg.serialized === "Undefined") {
            return undefined;
        }
        if (typeof arg === "object") {
            return deserializeObject(arg);
        }
        return arg;
    }

    const [matcher, options, waitForOptions] = args.map(deserializeArg);

    void (async () => {
        let result: ReturnType<(typeof window.TestingLibraryDom)[typeof query]> = null;
        try {
            // Override RegExp to fix 'matcher instanceof RegExp' check on Firefox
            window.RegExp = RegExp;

            result = await window.TestingLibraryDom[query](
                container,
                // @ts-expect-error Matcher can be any type from @testing-library/dom
                matcher as Matcher,
                options as MatcherOptions,
                waitForOptions as WaitForOptions,
            );
        } catch (e: unknown) {
            return done((e as Error).message);
        }

        if (!result) {
            return done(null);
        }

        function makeSelectorResult(element: HTMLElement): { selector: string } {
            const elementIdAttributeName = "data-wdio-testing-lib-element-id";
            let elementId = element.getAttribute(elementIdAttributeName);

            // if id doesn't already exist create one and add it to element
            if (!elementId) {
                elementId = (Math.abs(Math.random()) * 1000000000000).toFixed(0);
                element.setAttribute(elementIdAttributeName, elementId);
            }

            return { selector: `[${elementIdAttributeName}="${elementId}"]` };
        }

        if (Array.isArray(result)) {
            return done(result.map(makeSelectorResult));
        }

        return done(makeSelectorResult(result));
    })();
}

function createQuery(container: ElementBase, queryName: QueryName) {
    return async (...args: QueryArg[]) => {
        await injectDOMTestingLibrary(container);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result: SerializedQueryResult = await findContainerWithExecute(container).executeAsync(
            executeQuery,
            queryName,
            container,
            ...args.map(serializeArg),
        );

        if (typeof result === "string") {
            throw new Error(result);
        }

        if (!result) {
            return null;
        }

        if (Array.isArray(result)) {
            return Promise.all(result.map(({ selector }) => container.$(selector)));
        }

        return container.$(result.selector);
    };
}

function within(element: ElementBase) {
    return (Object.keys(baseQueries) as QueryName[]).reduce(
        (queries, queryName) => ({
            ...queries,
            [queryName]: createQuery(element, queryName),
        }),
        {},
    ) as WebdriverIOQueries;
}

/*
eslint-disable
@typescript-eslint/no-explicit-any,
@typescript-eslint/no-unsafe-argument
*/

// Patches (via addCommand) the browser object with the DomTestingLibrary queries
function setupBrowser<Browser extends WebdriverIO.Browser & BrowserBase>(browser: Browser): WebdriverIOQueries {
    const queries: { [key: string | number | symbol]: WebdriverIOQueries[QueryName] } = {};

    Object.keys(baseQueries).forEach(key => {
        const queryName = key as QueryName;

        const query = async (...args: Parameters<WebdriverIOQueries[QueryName]>) => {
            const body = await browser.$("body");
            return within(body as ElementBase)[queryName](...(args as any[]));
        };

        // add query to response queries
        queries[queryName] = query as WebdriverIOQueries[QueryName];

        // add query to BrowserObject and Elements
        browser.addCommand(queryName, query as WebdriverIOQueries[QueryName]);
        browser.addCommand(
            queryName,
            function (this: ElementBase, ...args: any) {
                return within(this)[queryName](...args);
            },
            true,
        );

        // add chainable query to BrowserObject and Elements
        browser.addCommand(`${queryName}$`, query as WebdriverIOQueriesChainable<Browser>[`${QueryName}$`]);
        browser.addCommand(
            `${queryName}$`,
            function (this: ElementBase, ...args) {
                return within(this)[queryName](...args);
            },
            true,
        );
    });

    return queries as unknown as WebdriverIOQueries;
}

/*
eslint-enable
@typescript-eslint/no-explicit-any,
@typescript-eslint/no-unsafe-argument
*/

function configure(config: Partial<Config>) {
    _config = config;

    console.log(_config);
}

export * from "./types.js";
export { within, setupBrowser, configure };
