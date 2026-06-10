import { BIDIEmitter } from "../emitter";
import type { BIDIConnection } from "../connection";
import type {
    BiDiScriptAddPreloadScriptParameters,
    BiDiScriptAddPreloadScriptResult,
    BiDiScriptCallFunctionParameters,
    BiDiScriptCallFunctionResult,
    BiDiScriptDisownParameters,
    BiDiScriptDisownResult,
    BiDiScriptEvaluateParameters,
    BiDiScriptEvaluateResult,
    BiDiScriptGetRealmsParameters,
    BiDiScriptGetRealmsResult,
    BiDiScriptMessageParameters,
    BiDiScriptRealmDestroyedParameters,
    BiDiScriptRealmInfo,
    BiDiScriptRemovePreloadScriptParameters,
    BiDiScriptRemovePreloadScriptResult,
} from "../types";

export interface BiDiScriptEvents {
    message: BiDiScriptMessageParameters;
    realmCreated: BiDiScriptRealmInfo;
    realmDestroyed: BiDiScriptRealmDestroyedParameters;
}

/** @link https://www.w3.org/TR/webdriver-bidi/#module-script */
export class BiDiScript extends BIDIEmitter<BiDiScriptEvents> {
    private readonly _connection: BIDIConnection;

    public constructor(connection: BIDIConnection) {
        super();

        this._connection = connection;
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-script-addPreloadScript
     */
    async addPreloadScript(params: BiDiScriptAddPreloadScriptParameters): Promise<BiDiScriptAddPreloadScriptResult> {
        return this._connection.request("script.addPreloadScript", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-script-callFunction
     */
    async callFunction(params: BiDiScriptCallFunctionParameters): Promise<BiDiScriptCallFunctionResult> {
        return this._connection.request("script.callFunction", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-script-disown
     */
    async disown(params: BiDiScriptDisownParameters): Promise<BiDiScriptDisownResult> {
        return this._connection.request("script.disown", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-script-evaluate
     */
    async evaluate(params: BiDiScriptEvaluateParameters): Promise<BiDiScriptEvaluateResult> {
        return this._connection.request("script.evaluate", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-script-getRealms
     */
    async getRealms(params: BiDiScriptGetRealmsParameters): Promise<BiDiScriptGetRealmsResult> {
        return this._connection.request("script.getRealms", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-script-removePreloadScript
     */
    async removePreloadScript(
        params: BiDiScriptRemovePreloadScriptParameters,
    ): Promise<BiDiScriptRemovePreloadScriptResult> {
        return this._connection.request("script.removePreloadScript", params);
    }
}
