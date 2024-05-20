import type { EventEmitter } from "events";
import type { AssertViewCommand, AssertViewElementCommand } from "./commands/types";
import type { BrowserConfig } from "./../config/browser-config";
import type { ExecutionThreadToolCtx } from "../types";
import { MoveCursorToCommand } from "./commands/moveCursorTo";
import { OpenAndWaitCommand } from "./commands/openAndWait";
import Callstack from "./history/callstack";
import { Test, Hook } from "../test-reader/test-object";

export interface BrowserMeta {
    pid: number;
    browserVersion: string;
    [name: string]: unknown;
}

export interface Browser {
    publicAPI: WebdriverIO.Browser;
    config: BrowserConfig;
    state: Record<string, unknown>;
    applyState: (state: Record<string, unknown>) => void;
    callstackHistory: Callstack;
    customCommands: { name: string; elementScope: boolean }[];
}

type FunctionProperties<T> = Exclude<
    {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
    }[keyof T],
    undefined
>;

type EventEmitterMethod = FunctionProperties<EventEmitter>;

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace WebdriverIO {
        type BrowserCommand = Exclude<FunctionProperties<WebdriverIO.Browser>, EventEmitterMethod>;
        type ElementCommand = Exclude<FunctionProperties<WebdriverIO.Element>, EventEmitterMethod>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type OverwriteCommandFn<ThisArg, Fn extends (...args: any) => any> = (
            this: ThisArg,
            origCommand: OmitThisParameter<Fn>,
            ...args: Parameters<Fn>
        ) => ReturnType<Fn>;

        interface Browser {
            getMeta(this: WebdriverIO.Browser): Promise<BrowserMeta>;
            getMeta(this: WebdriverIO.Browser, key: string): Promise<unknown>;

            setMeta(this: WebdriverIO.Browser, key: string, value: unknown): Promise<void>;

            extendOptions(this: WebdriverIO.Browser, opts: { [name: string]: unknown }): Promise<void>;

            getConfig(this: WebdriverIO.Browser): Promise<BrowserConfig>;

            overwriteCommand<CommandName extends BrowserCommand>(
                name: CommandName,
                func: OverwriteCommandFn<WebdriverIO.Browser, WebdriverIO.Browser[CommandName]>,
                attachToElement?: false,
                proto?: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
                instances?: Record<string, WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser>,
            ): void;

            overwriteCommand<CommandName extends ElementCommand>(
                name: CommandName,
                func: OverwriteCommandFn<WebdriverIO.Element, WebdriverIO.Element[CommandName]>,
                attachToElement: true,
                proto?: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
                instances?: Record<string, WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser>,
            ): void;

            /**
             * Takes a screenshot of the passed selector and compares the received screenshot with the reference.
             *
             * @remarks
             * For more details, see {@link https://github.com/gemini-testing/testplane#assertview documentation}.
             *
             * @example
             * ```ts
             *
             * it('some test', async function() {
             *     await this.browser.url('some/url');
             *     await this.browser.assertView('plain', '.button', {
             *         ignoreElements: ['.link'],
             *         tolerance: 2.3,
             *         antialiasingTolerance: 4,
             *         allowViewportOverflow: true,
             *         captureElementFromTop: true,
             *         compositeImage: true,
             *         screenshotDelay: 600,
             *         selectorToScroll: '.modal'
             *     });
             *});
             * ```
             *
             * @param state state name, should be unique within one test
             * @param selectors DOM-node selector that you need to capture
             * @param opts additional options, currently available:
             * "ignoreElements", "tolerance", "antialiasingTolerance", "allowViewportOverflow", "captureElementFromTop",
             * "compositeImage", "screenshotDelay", "selectorToScroll"
             */
            assertView: AssertViewCommand;

            /**
             * Command that allows to add human-readable description for commands in history
             *
             * @remarks
             * For more details, see {@link https://github.com/gemini-testing/testplane#runstep documentation}
             *
             * @example
             * ```ts
             * it('some test', async function () {
             *     await this.browser.runStep('step name', async () => {
             *         await this.browser.url('some/url');
             *         ...
             *     });
             * })
             * ```
             *
             * @param stepName step name
             * @param stepCb step callback
             * @returns {Promise<T>} value, returned by `stepCb`
             */
            runStep<T = unknown>(this: WebdriverIO.Browser, stepName: string, stepCb: () => Promise<T> | T): Promise<T>;

            // TODO: describe executionContext more precisely
            executionContext: (Test | Hook) & {
                testplaneCtx: ExecutionThreadToolCtx;
                /**
                 * @deprecated Use `testplaneCtx` instead
                 */
                hermioneCtx: ExecutionThreadToolCtx;
                ctx: {
                    browser: WebdriverIO.Browser;
                    currentTest: Test;
                };
            };

            openAndWait: OpenAndWaitCommand;

            switchToRepl: (this: WebdriverIO.Browser, ctx?: Record<string, unknown>) => Promise<void>;

            clearSession: (this: WebdriverIO.Browser) => Promise<void>;
        }

        interface Element {
            /**
             * Takes a screenshot of the element and compares the received screenshot with the reference.
             *
             * @remarks
             * For more details, see {@link https://github.com/gemini-testing/testplane#assertview documentation}.
             *
             * @example
             * ```ts
             *
             * it('some test', async function() {
             *     await this.browser.url('some/url');
             *     const button = await this.browser.$('.button');
             *     await button.assertView('plain', {
             *         ignoreElements: ['.link'],
             *         tolerance: 2.3,
             *         antialiasingTolerance: 4,
             *         allowViewportOverflow: true,
             *         captureElementFromTop: true,
             *         compositeImage: true,
             *         screenshotDelay: 600,
             *         selectorToScroll: '.modal'
             *     });
             *});
             * ```
             *
             * @param state state name, should be unique within one test
             * @param opts additional options, currently available:
             * "ignoreElements", "tolerance", "antialiasingTolerance", "allowViewportOverflow", "captureElementFromTop",
             * "compositeImage", "screenshotDelay", "selectorToScroll"
             */
            assertView: AssertViewElementCommand;

            moveCursorTo: MoveCursorToCommand;
        }
    }
}
