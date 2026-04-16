import { inspect } from "node:util";
import path from "path";
import fs from "fs";
import makeDebug from "debug";
import { ClientBridgeError } from "./error";

const debug = makeDebug("testplane:client-bridge");

const bundlesCache: Record<string, string> = {};

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

        if (bundlesCache[scriptFilePath]) {
            return new ClientBridge(browser, bundlesCache[scriptFilePath], namespace);
        }

        const bundle = await fs.promises.readFile(scriptFilePath, { encoding: "utf8" });
        bundlesCache[scriptFilePath] = bundle;

        return new this(browser, bundle, namespace);
    }

    constructor(browser: Browser, script: string, namespace: string) {
        this._browser = browser;
        this._script = script;
        this._namespace = namespace;
    }

    async call<K extends keyof T>(name: K, args: Parameters<T[K]>): Promise<ReturnType<T[K]>> {
        return this._callCommand<T>(this._clientMethodCommand(name, args), true) as ReturnType<T[K]>;
    }

    private async _callCommand<T>(command: string, shouldInjectScriptBeforeCall: boolean): Promise<T> {
        try {
            if (debug.enabled) {
                debug(` > calling command ${command}`);
            }

            const result = await this._browser.execute<{ isClientScriptNotInjected?: boolean }>(command);

            if (debug.enabled) {
                debug(` < result for command ${command.slice(0, 256)}: ${inspect(result, { depth: null })}`);
            }

            if (!result || !result.isClientScriptNotInjected) {
                return result as T;
            }

            if (shouldInjectScriptBeforeCall) {
                await this._inject();
                return this._callCommand<T>(command, false);
            }

            throw new ClientBridgeError("Unable to inject client script");
        } catch (e) {
            throw new ClientBridgeError(
                `Failed to call command ${command} due to error: ${(e as Error)?.message ?? "Unknown error"}`,
                { cause: e },
            );
        }
    }

    private _clientMethodCommand<K extends keyof T>(name: K, args: Parameters<T[K]>): string {
        const params = args.map(arg => (arg !== undefined ? JSON.stringify(arg) : "undefined")).join(", ");
        const call = `__geminiCore['${this._namespace}'].${String(name)}(${params})`;
        return this._guardClientCall(call);
    }

    private _guardClientCall(call: string): string {
        return `return (typeof __geminiCore !== "undefined" && typeof __geminiCore['${this._namespace}'] !== "undefined") ? ${call} : {isClientScriptNotInjected: true}`;
    }

    private async _inject(): Promise<void> {
        debug(` > injecting script into namespace ${this._namespace}`);
        if (debug.enabled) {
            console.log(this._script);
        }
        await this._browser.execute(this._script, this._namespace);
    }
}
