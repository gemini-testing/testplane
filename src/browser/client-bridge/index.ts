import { inspect } from "node:util";
import path from "path";
import fs from "fs";
import makeDebug from "debug";
import { ClientBridgeError } from "./error";
import { WdioBrowser } from "../../types";

const debug = makeDebug("testplane:client-bridge");

const bundlesCache: Record<string, string> = {};

export type ClientBridgeArgument<T> = T extends Element
    ? WebdriverIO.Element
    : T extends object
    ? { [K in keyof T]: ClientBridgeArgument<T[K]> }
    : T;

interface Browser {
    execute: <R>(command: string, ...args: unknown[]) => Promise<R>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class ClientBridge<T extends Record<string, (...args: any[]) => any>> {
    private _browser: Browser;
    private _script: string;
    private _namespace: string;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async create<T extends Record<string, (...args: any[]) => any>>(
        browser: Browser,
        namespace: string,
        opts: { needsCompatLib?: boolean },
    ): Promise<ClientBridge<T>> {
        const needsCompatLib = opts?.needsCompatLib ?? false;
        const scriptFileName = needsCompatLib ? "bundle.compat.js" : "bundle.native.js";
        const scriptFilePath = path.join(__dirname, "..", "client-scripts", namespace, "build", scriptFileName);

        let debugBrowserId = "";
        if (debug.enabled) {
            debugBrowserId = `${(browser as WdioBrowser)?.capabilities?.browserName} ${
                (browser as WdioBrowser)?.capabilities?.browserVersion
            }:${(browser as WdioBrowser)?.sessionId}`;
        }

        if (bundlesCache[scriptFilePath]) {
            debug(
                `creating ClientBridge with cached script for namespace ${namespace} at ${scriptFilePath} for browser ${debugBrowserId}`,
            );
            return new ClientBridge(browser, bundlesCache[scriptFilePath], namespace);
        }

        const bundle = await fs.promises.readFile(scriptFilePath, { encoding: "utf8" });
        bundlesCache[scriptFilePath] = bundle;

        debug(
            `creating ClientBridge with new script for namespace ${namespace} at ${scriptFilePath} for browser ${debugBrowserId}`,
        );

        return new this(browser, bundle, namespace);
    }

    constructor(browser: Browser, script: string, namespace: string) {
        this._browser = browser;
        this._script = script;
        this._namespace = namespace;
    }

    async call<K extends keyof T>(name: K, args: ClientBridgeArgument<Parameters<T[K]>>): Promise<ReturnType<T[K]>> {
        return this._callCommand<ReturnType<T[K]>>(this._clientMethodCommand(name), args, true);
    }

    private async _callCommand<T>(command: string, args: unknown[], shouldInjectScriptBeforeCall: boolean): Promise<T> {
        try {
            if (debug.enabled) {
                debug(` > calling command ${command}`);
            }

            const result = await this._browser.execute<{ isClientScriptNotInjected?: boolean }>(command, ...args);

            if (debug.enabled) {
                debug(` < result for command ${command.slice(0, 256)}: ${inspect(result, { depth: null })}`);
            }

            if (!result || !result.isClientScriptNotInjected) {
                return result as T;
            }

            if (shouldInjectScriptBeforeCall) {
                await this._inject();
                return this._callCommand<T>(command, args, false);
            }

            throw new ClientBridgeError("Unable to inject client script");
        } catch (e) {
            throw new ClientBridgeError(
                `Failed to call command ${command} due to error: ${(e as Error)?.message ?? "Unknown error"}`,
                { cause: e },
            );
        }
    }

    private _clientMethodCommand<K extends keyof T>(name: K): string {
        const namespace = `__geminiCore['${this._namespace}']`;
        const call = `${namespace}.${String(name)}.apply(${namespace}, arguments)`;
        return this._guardClientCall(call);
    }

    private _guardClientCall(call: string): string {
        return `return (typeof __geminiCore !== "undefined" && typeof __geminiCore['${this._namespace}'] !== "undefined") ? ${call} : {isClientScriptNotInjected: true}`;
    }

    private async _inject(): Promise<void> {
        debug(` > injecting script into namespace ${this._namespace}: ${this._script.slice(0, 256)}...`);
        await this._browser.execute(this._script, this._namespace);
    }
}
