import { BrowserEventNames, WorkerEventNames, type WorkerExpectMatherResultMessage } from "./types.js";

// import { expect, type MatcherContext, type ExpectationResult, type SyncExpectationResult } from 'expect';
import { expect, type MatcherState } from 'expect';
import type { ChainablePromiseElement, ChainablePromiseArray } from 'webdriverio'
import type { ExpectMatcherMessage } from "./types.js";
// import { expect } from 'expect';

// declare type RawMatcherFn<Context extends MatcherState = MatcherState> = {
//     (this: Context, actual: any, ...expected: Array<any>): ExpectationResult;
// };

type SyncExpectationResult = {
  pass: boolean;
  message(): string;
};
type AsyncExpectationResult = Promise<SyncExpectationResult>;
// type ExpectationResult = SyncExpectationResult | AsyncExpectationResult;

type MatcherFn = {
    (this: MatcherState, context: WebdriverIO.Browser | WebdriverIO.Element | ChainablePromiseElement<WebdriverIO.Element> | ChainablePromiseArray<unknown>, ...args: any[]): AsyncExpectationResult
}

interface MatcherMessagePromise {
    resolve: (value: SyncExpectationResult) => void
    // reject: (err: Error) => void
    commandTimeout?: NodeJS.Timeout
}

const asymmetricMatcher =
    typeof Symbol === 'function' && Symbol.for
        ? Symbol.for('jest.asymmetricMatcher')
        : 0x13_57_a5;

const { communicator } = window.__hermione__;
const matcherResultMessages = new Map<string, MatcherMessagePromise>();
const COMMAND_TIMEOUT = 30 * 1000; // 30s

const createMatcher = (matcherName: string) => {
    const matcherFn: MatcherFn = async function (context, ...args) {
        if (typeof args[0] === 'object' && '$$typeof' in args[0] && args[0].$$typeof === asymmetricMatcher && args[0].asymmetricMatch) {
            args[0] = {
                $$typeof: args[0].toString(),
                sample: args[0].sample,
                inverse: args[0].inverse
            }
        }

        const matcherMessage: ExpectMatcherMessage = {
            name: matcherName,
            scope: this,
            args,
        };

        const isContextObject = typeof context === 'object';

        /**
         * Check if context is an WebdriverIO.Element
         */
        if (isContextObject && 'elementId' in context && typeof context.elementId === 'string') {
            matcherMessage.element = context;
        }

        /**
         * Check if context is ChainablePromiseElement
         */
        if (isContextObject && 'then' in context && typeof (context as any).selector === 'object') {
            matcherMessage.element = await context;
        }

        /**
         * Check if context is a `Element` and transform it into a WebdriverIO.Element
         */
        if (context instanceof Element) {
            matcherMessage.element = await window.browser.$(context as any as HTMLElement)
        } else if (isContextObject && !('sessionId' in context)) {
            /**
             * check if context is an object or promise and resolve it
             * but not pass through the browser object
             */
            matcherMessage.context = context;
            if ('then' in context) {
                matcherMessage.context = await context;
            }
        } else if (!isContextObject) {
            /**
             * if context is not an object or promise, pass it through
             */
            matcherMessage.context = context;
        }

        /**
         * Avoid serialization issues when sending over the element. If we create
         * an element from an existing HTMLElement, it might have custom properties
         * attached to it that can't be serialized.
         */
        if (matcherMessage.element && typeof matcherMessage.element.selector !== 'string') {
            matcherMessage.element.selector = undefined
        }

        // TODO: should I use it???
        /**
         * pass along the stack trace from the browser to the testrunner so that
         * the snapshot tool can determine the correct location to update the
         * snapshot call.
         */
        if (matcherName === 'toMatchInlineSnapshot') {
            matcherMessage.scope.errorStack = (new Error('inline snapshot error'))
                .stack
                ?.split('\n')
                .find((line) => line.includes(window.__hermione__.file))
                /**
                 * stack traces within the browser have an url path, e.g.
                 * `http://localhost:8080/@fs/path/to/__tests__/unit/snapshot.test.js:123:45`
                 * that we want to remove so that the stack trace is properly
                 * parsed by Vitest, e.g. make it to:
                 * `/__tests__/unit/snapshot.test.js:123:45`
                 */
                ?.replace(/http:\/\/localhost:\d+/g, '')
                .replace('/@fs/', '/');
        }

        console.log('this:', this);
        console.log('context:', context);
        console.log('args:', args);

        const cmdUuid = crypto.randomUUID();
        communicator.sendMessage(BrowserEventNames.runExpectMatcher, {
            cmdUuid,
            matcher: matcherMessage
        });

        const contextString = isContextObject
            ? 'elementId' in context
                ? 'WebdriverIO.Element'
                : 'WebdriverIO.Browser'
            : context;

        return new Promise((resolve, reject) => {
            // TODO: which timeout I should use here? Maybe from config ???
            const commandTimeout = setTimeout(
                () => reject(new Error(`Assertion expect(${contextString}).${matcherName}(...) timed out`)),
                COMMAND_TIMEOUT
            );

            matcherResultMessages.set(cmdUuid, { resolve, commandTimeout })
        });
    }

    return matcherFn;
}

const newMatchers = window.__hermione__.expectMatchers.filter(matcherName => {
    return !expect.hasOwnProperty(matcherName) && !matcherName.startsWith("_");
});

const matchers = newMatchers.reduce((acc, matcherName) => {
    acc[matcherName] = createMatcher(matcherName);
    return acc;
}, {} as Record<string, MatcherFn>);

expect.extend(matchers);

communicator.subscribeOnMessage<WorkerEventNames.expectMatcherResult>(WorkerEventNames.expectMatcherResult, async (msg: WorkerExpectMatherResultMessage) => {
    if (!msg.cmdUuid) {
        return console.error(`Got message from worker without cmdUuid: ${JSON.stringify(msg)}`);
    }

    const matcherResult = matcherResultMessages.get(msg.cmdUuid);
    if (!matcherResult) {
        return console.error(`Command with cmdUuid "${msg.cmdUuid}" does not found`);
    }

    const { pass, message } = msg;

    if (matcherResult.commandTimeout) {
        clearTimeout(matcherResult.commandTimeout);
    }

    matcherResultMessages.delete(msg.cmdUuid);
    matcherResult.resolve({
        pass,
        message: () => message,
    });
});


// console.log('@@@ expect.extend:', (expect as any).extend);
// console.log('@@@ expect.expect.extend:', expect.expect.extend);

// expect.extend(window.__hermione__.expectMatchers);

// const { communicator } = window.__hermione__;

// const cmdUuid = crypto.randomUUID();

// communicator.subscribeOnMessage<WorkerEventNames.>(
//     WorkerEventNames.commandResult,
//     this.#handleCommandResultMessage.bind(this)
// );

// communicator.sendMessage(BrowserEventNames.getExpectMatchers, {cmdUuid});

export { expect };


// ['length', 'name', 'extend', 'anything', 'any', 'not', 'arrayContaining', 'closeTo', 'objectContaining', 'stringContaining', 'stringMatching', 'assertions', 'hasAssertions', 'getState', 'setState', 'extractExpectedAssertionsErrors']
