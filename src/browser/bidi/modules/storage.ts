import type { BIDIConnection } from "../connection";
import type {
    BiDiStorageDeleteCookiesParameters,
    BiDiStorageDeleteCookiesResult,
    BiDiStorageGetCookiesParameters,
    BiDiStorageGetCookiesResult,
    BiDiStorageSetCookieParameters,
    BiDiStorageSetCookieResult,
} from "../types";

/** @link https://www.w3.org/TR/webdriver-bidi/#module-storage */
export class BiDiStorage {
    private readonly _connection: BIDIConnection;

    public constructor(connection: BIDIConnection) {
        this._connection = connection;
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-storage-getCookies
     */
    async getCookies(params: BiDiStorageGetCookiesParameters): Promise<BiDiStorageGetCookiesResult> {
        return this._connection.request("storage.getCookies", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-storage-setCookie
     */
    async setCookie(params: BiDiStorageSetCookieParameters): Promise<BiDiStorageSetCookieResult> {
        return this._connection.request("storage.setCookie", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-storage-deleteCookies
     */
    async deleteCookies(params: BiDiStorageDeleteCookiesParameters): Promise<BiDiStorageDeleteCookiesResult> {
        return this._connection.request("storage.deleteCookies", params);
    }
}
