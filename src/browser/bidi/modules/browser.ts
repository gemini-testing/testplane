import type { BIDIConnection } from "../connection";
import type {
    BiDiBrowserCreateUserContextParameters,
    BiDiBrowserGetClientWindowsResult,
    BiDiBrowserGetUserContextsResult,
    BiDiBrowserRemoveUserContextParameters,
    BiDiBrowserRemoveUserContextResult,
    BiDiBrowserSetClientWindowStateParameters,
    BiDiBrowserSetClientWindowStateResult,
    BiDiBrowserSetDownloadBehaviorParameters,
    BiDiBrowserSetDownloadBehaviorResult,
    BiDiBrowserUserContextInfo,
} from "../types";

/** @link https://www.w3.org/TR/webdriver-bidi/#module-browser */
export class BiDiBrowser {
    private readonly _connection: BIDIConnection;

    public constructor(connection: BIDIConnection) {
        this._connection = connection;
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browser-close
     */
    async close(): Promise<void> {
        return this._connection.request("browser.close");
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browser-createUserContext
     */
    async createUserContext(params: BiDiBrowserCreateUserContextParameters): Promise<BiDiBrowserUserContextInfo> {
        return this._connection.request("browser.createUserContext", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browser-getClientWindows
     */
    async getClientWindows(): Promise<BiDiBrowserGetClientWindowsResult> {
        return this._connection.request("browser.getClientWindows");
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browser-getUserContexts
     */
    async getUserContexts(): Promise<BiDiBrowserGetUserContextsResult> {
        return this._connection.request("browser.getUserContexts");
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browser-removeUserContext
     */
    async removeUserContext(
        params: BiDiBrowserRemoveUserContextParameters,
    ): Promise<BiDiBrowserRemoveUserContextResult> {
        return this._connection.request("browser.removeUserContext", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browser-setClientWindowState
     */
    async setClientWindowState(
        params: BiDiBrowserSetClientWindowStateParameters,
    ): Promise<BiDiBrowserSetClientWindowStateResult> {
        return this._connection.request("browser.setClientWindowState", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browser-setDownloadBehavior
     */
    async setDownloadBehavior(
        params: BiDiBrowserSetDownloadBehaviorParameters,
    ): Promise<BiDiBrowserSetDownloadBehaviorResult> {
        return this._connection.request("browser.setDownloadBehavior", params);
    }
}
