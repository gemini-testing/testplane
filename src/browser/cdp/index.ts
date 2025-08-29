import type { Browser } from "../types";
import { CDPConnection } from "./connection";
import { CDPTarget } from "./target";
import { CDPProfiler } from "./profiler";
import type { CDPEvent } from "./types";

export class CDP {
    private readonly _connection: CDPConnection;
    public readonly target: CDPTarget;
    public readonly profiler: CDPProfiler;

    static async create(browser: Browser): Promise<CDP | null> {
        if (!browser.publicAPI.isChromium) {
            return null;
        }

        const connection = await CDPConnection.create(browser).catch(() => null);

        return connection ? new this(connection) : null;
    }

    constructor(connection: CDPConnection) {
        this._connection = connection;
        this.target = new CDPTarget(connection);
        this.profiler = new CDPProfiler(connection);
        this._connection.onEventMessage = this._onEventMessage.bind(this);
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
        }
    }
}
