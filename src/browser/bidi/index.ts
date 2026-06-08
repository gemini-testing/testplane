import { BIDIConnection } from "./connection";
import { BiDiBrowser } from "./modules/browser";
import { BiDiBrowsingContext } from "./modules/browsing-context";
import { BiDiEmulation } from "./modules/emulation";
import { BiDiInput } from "./modules/input";
import { BiDiLog } from "./modules/log";
import { BiDiNetwork } from "./modules/network";
import { BiDiScript } from "./modules/script";
import { BiDiSession } from "./modules/session";
import { BiDiStorage } from "./modules/storage";
import { BiDiWebExtension } from "./modules/web-extension";
import type { Browser } from "../types";
import type { BiDiCommand, BiDiEvent } from "./types";

export class BIDI {
    private readonly _connection: BIDIConnection;
    public readonly browser: BiDiBrowser;
    public readonly browsingContext: BiDiBrowsingContext;
    public readonly emulation: BiDiEmulation;
    public readonly input: BiDiInput;
    public readonly log: BiDiLog;
    public readonly network: BiDiNetwork;
    public readonly script: BiDiScript;
    public readonly session: BiDiSession;
    public readonly storage: BiDiStorage;
    public readonly webExtension: BiDiWebExtension;

    static create(browser: Browser): BIDI | null {
        const connection = BIDIConnection.create(browser);

        return connection ? new this(connection) : null;
    }

    constructor(connection: BIDIConnection) {
        this._connection = connection;
        this.browser = new BiDiBrowser(connection);
        this.browsingContext = new BiDiBrowsingContext(connection);
        this.emulation = new BiDiEmulation(connection);
        this.input = new BiDiInput(connection);
        this.log = new BiDiLog();
        this.network = new BiDiNetwork(connection);
        this.script = new BiDiScript(connection);
        this.session = new BiDiSession(connection);
        this.storage = new BiDiStorage(connection);
        this.webExtension = new BiDiWebExtension(connection);
        this._connection.onEventMessage = this._onEventMessage.bind(this);
    }

    async request<T = void>(method: BiDiCommand["method"], params?: BiDiCommand["params"]): Promise<T> {
        return this._connection.request<T>(method, params);
    }

    close(): void {
        this._connection.close();
    }

    private _onEventMessage(bidiEventMessage: BiDiEvent): void {
        const [moduleName, event] = bidiEventMessage.method.split(".", 2);

        switch (moduleName) {
            case "browsingContext":
                this.browsingContext.emit(event, bidiEventMessage.params);
                break;
            case "input":
                this.input.emit(event, bidiEventMessage.params);
                break;
            case "log":
                this.log.emit(event, bidiEventMessage.params);
                break;
            case "network":
                this.network.emit(event, bidiEventMessage.params);
                break;
            case "script":
                this.script.emit(event, bidiEventMessage.params);
                break;
        }
    }
}
