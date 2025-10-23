import type { Browser } from "../types";
import type { CDPEvent, CDPRequest, CDPSessionId } from "./types";
import { CDPConnection } from "./connection";
import { CDPTarget } from "./domains/target";
import { CDPProfiler } from "./domains/profiler";
import { CDPDebugger } from "./domains/debugger";
import { CDPRuntime } from "./domains/runtime";
import { CDPDom } from "./domains/dom";
import { CDPCss } from "./domains/css";

export class CDP {
    private readonly _connection: CDPConnection;
    public readonly target: CDPTarget;
    public readonly profiler: CDPProfiler;
    public readonly debugger: CDPDebugger;
    public readonly runtime: CDPRuntime;
    public readonly dom: CDPDom;
    public readonly css: CDPCss;

    static async create(browser: Browser): Promise<CDP | null> {
        // "isChrome" is "true" when automationProtocol is "devtools"
        const isChromiumLike = browser.publicAPI.isChromium || (browser.publicAPI as { isChrome?: boolean }).isChrome;

        if (!isChromiumLike) {
            return null;
        }

        const connection = await CDPConnection.create(browser).catch(() => null);

        return connection ? new this(connection) : null;
    }

    constructor(connection: CDPConnection) {
        this._connection = connection;
        this.target = new CDPTarget(connection);
        this.profiler = new CDPProfiler(connection);
        this.debugger = new CDPDebugger(connection);
        this.runtime = new CDPRuntime(connection);
        this.dom = new CDPDom(connection);
        this.css = new CDPCss(connection);
        this._connection.onEventMessage = this._onEventMessage.bind(this);
    }

    async request<T = Record<string, unknown>>(
        method: CDPRequest["method"],
        params?: CDPRequest["params"] | null,
        cdpSessionId?: CDPSessionId | null,
    ): Promise<T> {
        return this._connection.request<T>(method, {
            params: params ?? undefined,
            sessionId: cdpSessionId ?? undefined,
        });
    }

    close(): void {
        this._connection.close();
    }

    private _onEventMessage(cdpEventMessage: CDPEvent): void {
        const [domain, method] = cdpEventMessage.method.split(".", 2);

        switch (domain) {
            case "Target":
                this.target.emit(method, cdpEventMessage.params);
                break;
            case "Profiler":
                this.profiler.emit(method, cdpEventMessage.params);
                break;
            case "Debugger":
                this.debugger.emit(method, cdpEventMessage.params);
                break;
            case "Runtime":
                this.runtime.emit(method, cdpEventMessage.params);
                break;
            case "DOM":
                this.dom.emit(method, cdpEventMessage.params);
                break;
            case "CSS":
                this.css.emit(method, cdpEventMessage.params);
                break;
        }
    }
}
