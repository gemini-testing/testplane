import type { BIDIConnection } from "../connection";
import type {
    BiDiWebExtensionInstallParameters,
    BiDiWebExtensionInstallResult,
    BiDiWebExtensionUninstallParameters,
    BiDiWebExtensionUninstallResult,
} from "../types";

/** @link https://www.w3.org/TR/webdriver-bidi/#module-webExtension */
export class BiDiWebExtension {
    private readonly _connection: BIDIConnection;

    public constructor(connection: BIDIConnection) {
        this._connection = connection;
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-webExtension-install
     */
    async install(params: BiDiWebExtensionInstallParameters): Promise<BiDiWebExtensionInstallResult> {
        return this._connection.request("webExtension.install", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-webExtension-uninstall
     */
    async uninstall(params: BiDiWebExtensionUninstallParameters): Promise<BiDiWebExtensionUninstallResult> {
        return this._connection.request("webExtension.uninstall", params);
    }
}
