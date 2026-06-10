import type { BIDIConnection } from "../connection";
import type {
    BiDiEmulationSetForcedColorsModeThemeOverrideParameters,
    BiDiEmulationSetForcedColorsModeThemeOverrideResult,
    BiDiEmulationSetGeolocationOverrideParameters,
    BiDiEmulationSetGeolocationOverrideResult,
    BiDiEmulationSetLocaleOverrideParameters,
    BiDiEmulationSetLocaleOverrideResult,
    BiDiEmulationSetNetworkConditionsParameters,
    BiDiEmulationSetNetworkConditionsResult,
    BiDiEmulationSetScreenOrientationOverrideParameters,
    BiDiEmulationSetScreenOrientationOverrideResult,
    BiDiEmulationSetScreenSettingsOverrideParameters,
    BiDiEmulationSetScreenSettingsOverrideResult,
    BiDiEmulationSetScriptingEnabledParameters,
    BiDiEmulationSetScriptingEnabledResult,
    BiDiEmulationSetScrollbarTypeOverrideParameters,
    BiDiEmulationSetScrollbarTypeOverrideResult,
    BiDiEmulationSetTimezoneOverrideParameters,
    BiDiEmulationSetTimezoneOverrideResult,
    BiDiEmulationSetTouchOverrideParameters,
    BiDiEmulationSetTouchOverrideResult,
    BiDiEmulationSetUserAgentOverrideParameters,
    BiDiEmulationSetUserAgentOverrideResult,
} from "../types";

/** @link https://www.w3.org/TR/webdriver-bidi/#module-emulation */
export class BiDiEmulation {
    private readonly _connection: BIDIConnection;

    public constructor(connection: BIDIConnection) {
        this._connection = connection;
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-emulation-setForcedColorsModeThemeOverride
     */
    async setForcedColorsModeThemeOverride(
        params: BiDiEmulationSetForcedColorsModeThemeOverrideParameters,
    ): Promise<BiDiEmulationSetForcedColorsModeThemeOverrideResult> {
        return this._connection.request("emulation.setForcedColorsModeThemeOverride", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-emulation-setGeolocationOverride
     */
    async setGeolocationOverride(
        params: BiDiEmulationSetGeolocationOverrideParameters,
    ): Promise<BiDiEmulationSetGeolocationOverrideResult> {
        return this._connection.request("emulation.setGeolocationOverride", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-emulation-setLocaleOverride
     */
    async setLocaleOverride(
        params: BiDiEmulationSetLocaleOverrideParameters,
    ): Promise<BiDiEmulationSetLocaleOverrideResult> {
        return this._connection.request("emulation.setLocaleOverride", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-emulation-setNetworkConditions
     */
    async setNetworkConditions(
        params: BiDiEmulationSetNetworkConditionsParameters,
    ): Promise<BiDiEmulationSetNetworkConditionsResult> {
        return this._connection.request("emulation.setNetworkConditions", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-emulation-setScreenOrientationOverride
     */
    async setScreenOrientationOverride(
        params: BiDiEmulationSetScreenOrientationOverrideParameters,
    ): Promise<BiDiEmulationSetScreenOrientationOverrideResult> {
        return this._connection.request("emulation.setScreenOrientationOverride", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-emulation-setScreenSettingsOverride
     */
    async setScreenSettingsOverride(
        params: BiDiEmulationSetScreenSettingsOverrideParameters,
    ): Promise<BiDiEmulationSetScreenSettingsOverrideResult> {
        return this._connection.request("emulation.setScreenSettingsOverride", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-emulation-setScriptingEnabled
     */
    async setScriptingEnabled(
        params: BiDiEmulationSetScriptingEnabledParameters,
    ): Promise<BiDiEmulationSetScriptingEnabledResult> {
        return this._connection.request("emulation.setScriptingEnabled", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-emulation-setScrollbarTypeOverride
     */
    async setScrollbarTypeOverride(
        params: BiDiEmulationSetScrollbarTypeOverrideParameters,
    ): Promise<BiDiEmulationSetScrollbarTypeOverrideResult> {
        return this._connection.request("emulation.setScrollbarTypeOverride", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-emulation-setTimezoneOverride
     */
    async setTimezoneOverride(
        params: BiDiEmulationSetTimezoneOverrideParameters,
    ): Promise<BiDiEmulationSetTimezoneOverrideResult> {
        return this._connection.request("emulation.setTimezoneOverride", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-emulation-setTouchOverride
     */
    async setTouchOverride(
        params: BiDiEmulationSetTouchOverrideParameters,
    ): Promise<BiDiEmulationSetTouchOverrideResult> {
        return this._connection.request("emulation.setTouchOverride", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-emulation-setUserAgentOverride
     */
    async setUserAgentOverride(
        params: BiDiEmulationSetUserAgentOverrideParameters,
    ): Promise<BiDiEmulationSetUserAgentOverrideResult> {
        return this._connection.request("emulation.setUserAgentOverride", params);
    }
}
