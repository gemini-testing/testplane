/*
Portions of this functionality are copyright of their respective authors
and released under the MIT license:
https://github.com/testing-library/webdriverio-testing-library
*/

import path from "path";
import fs from "fs";
import {
    Matcher,
    MatcherOptions,
    queries as baseQueries,
    waitForOptions as WaitForOptions,
} from "@testing-library/dom";

import {
    QueryArg,
    Config,
    QueryName,
    TestplaneQueries,
    TestplaneQueriesChainable,
    ObjectQueryArg,
    SerializedObject,
    SerializedArg,
    SelectorsBase,
} from "./types";
import { ElementBase } from "@testplane/webdriverio";

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

function isContainerWithExecute(container: ElementBase | WebdriverIO.Browser): container is WebdriverIO.Browser {
    return (container as { execute?: unknown }).execute !== null;
}

function findContainerWithExecute(container: ElementBase): WebdriverIO.Browser {
    let curContainer: ElementBase | WebdriverIO.Browser = container.parent;
    while (!isContainerWithExecute(curContainer)) {
        curContainer = curContainer.parent;
    }
    return curContainer;
}

const findBrowser = (container: ElementBase): WebdriverIO.Browser => {
    let browser: ElementBase | WebdriverIO.Browser = container;
    while ((browser as ElementBase).parent && browser.capabilities === undefined) {
        browser = (browser as ElementBase).parent;
    }
    return browser as WebdriverIO.Browser;
};

async function injectDOMTestingLibrary(container: ElementBase) {
    const browser = findContainerWithExecute(container);
    const shouldInjectDTL = await browser.execute(function () {
        return !window.TestingLibraryDom;
    });

    if (shouldInjectDTL) {
        await browser.execute(function (library) {
            if (navigator.userAgent.indexOf("Firefox") !== -1) {
                try {
                    // Inject via inline-script
                    const script = window.document.createElement("script");
                    script.textContent = library;
                    window.document.head.append(script);
                    if (!window.TestingLibraryDom) {
                        // Inject via eval
                        window.eval(library);
                    }
                } catch (error) {
                    throw new Error(
                        `The DOM Testing Library cannot be injected on certain domains, particularly "${window.location.host}", due to restrictions imposed by the Content-Security-Policy (CSP) header.`,
                    );
                }
            } else {
                eval(library);
            }
        }, DOM_TESTING_LIBRARY_UMD);
    }

    await browser.execute(function (config: Partial<Config>) {
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
    return new Promise((done: (result: SerializedQueryResult) => void) => {
        function deserializeObject(object: SerializedObject) {
            return Object.entries(object)
                .map<[string, QueryArg]>(([key, value]) => [key, deserializeArg(value)])
                .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
        }

        function deserializeArg(arg: SerializedArg): QueryArg {
            if (typeof arg === "object" && arg === null) {
                return undefined;
            }
            if (typeof arg === "object" && (arg as { nodeType?: string }).nodeType !== undefined) {
                return arg as QueryArg;
            }
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
                const elementIdAttributeName = "data-testplane-element-id";
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
    });
}

function createQuery(container: ElementBase & SelectorsBase, queryName: QueryName) {
    return async (...args: QueryArg[]) => {
        await injectDOMTestingLibrary(container);

        const browser = findBrowser(container);
        const result: SerializedQueryResult = await browser.execute(
            executeQuery,
            queryName,
            container as unknown as HTMLElement,
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

function within(element: ElementBase & SelectorsBase) {
    return (Object.keys(baseQueries) as QueryName[]).reduce(
        (queries, queryName) => ({
            ...queries,
            [queryName]: createQuery(element, queryName),
        }),
        {},
    ) as TestplaneQueries;
}

/*
eslint-disable
@typescript-eslint/no-explicit-any,
@typescript-eslint/no-unsafe-argument
*/

// Patches (via addCommand) the browser object with the DomTestingLibrary queries
function setupBrowser<Browser extends WebdriverIO.Browser>(browser: Browser): TestplaneQueries {
    const queries: { [key: string | number | symbol]: TestplaneQueries[QueryName] } = {};

    Object.keys(baseQueries).forEach(key => {
        const queryName = key as QueryName;

        const query = async (...args: Parameters<TestplaneQueries[QueryName]>) => {
            const body = await browser.$("body");
            return within(body as ElementBase & SelectorsBase)[queryName](...(args as any[]));
        };

        // add query to response queries
        queries[queryName] = query as TestplaneQueries[QueryName];

        // add query to BrowserObject and Elements
        browser.addCommand(queryName, query as TestplaneQueries[QueryName]);
        browser.addCommand(
            queryName,
            function (this: ElementBase & SelectorsBase, ...args: any) {
                return within(this)[queryName](...args);
            },
            true,
        );

        // add chainable query to BrowserObject and Elements
        browser.addCommand(`${queryName}$`, query as TestplaneQueriesChainable<Browser>[`${QueryName}$`]);
        browser.addCommand(
            `${queryName}$`,
            function (this: ElementBase & SelectorsBase, ...args) {
                return within(this)[queryName](...args);
            },
            true,
        );
    });

    return queries as unknown as TestplaneQueries;
}

/*
eslint-enable
@typescript-eslint/no-explicit-any,
@typescript-eslint/no-unsafe-argument
*/

function configure(config: Partial<Config>) {
    _config = config;
}

export * from "./types";
export { within, setupBrowser, configure };
