import { BIDIEmitter } from "../emitter";
import type { BIDIConnection } from "../connection";
import type {
    BiDiNetworkAddDataCollectorParameters,
    BiDiNetworkAddDataCollectorResult,
    BiDiNetworkAddInterceptParameters,
    BiDiNetworkAddInterceptResult,
    BiDiNetworkAuthRequiredParameters,
    BiDiNetworkBeforeRequestSentParameters,
    BiDiNetworkContinueRequestParameters,
    BiDiNetworkContinueRequestResult,
    BiDiNetworkContinueResponseParameters,
    BiDiNetworkContinueResponseResult,
    BiDiNetworkContinueWithAuthParameters,
    BiDiNetworkContinueWithAuthResult,
    BiDiNetworkDisownDataParameters,
    BiDiNetworkDisownDataResult,
    BiDiNetworkFailRequestParameters,
    BiDiNetworkFailRequestResult,
    BiDiNetworkFetchErrorParameters,
    BiDiNetworkGetDataParameters,
    BiDiNetworkGetDataResult,
    BiDiNetworkProvideResponseParameters,
    BiDiNetworkProvideResponseResult,
    BiDiNetworkRemoveDataCollectorParameters,
    BiDiNetworkRemoveDataCollectorResult,
    BiDiNetworkRemoveInterceptParameters,
    BiDiNetworkRemoveInterceptResult,
    BiDiNetworkResponseCompletedParameters,
    BiDiNetworkResponseStartedParameters,
    BiDiNetworkSetCacheBehaviorParameters,
    BiDiNetworkSetCacheBehaviorResult,
    BiDiNetworkSetExtraHeadersParameters,
    BiDiNetworkSetExtraHeadersResult,
} from "../types";

export interface BiDiNetworkEvents {
    authRequired: BiDiNetworkAuthRequiredParameters;
    beforeRequestSent: BiDiNetworkBeforeRequestSentParameters;
    fetchError: BiDiNetworkFetchErrorParameters;
    responseCompleted: BiDiNetworkResponseCompletedParameters;
    responseStarted: BiDiNetworkResponseStartedParameters;
}

/** @link https://www.w3.org/TR/webdriver-bidi/#module-network */
export class BiDiNetwork extends BIDIEmitter<BiDiNetworkEvents> {
    private readonly _connection: BIDIConnection;

    public constructor(connection: BIDIConnection) {
        super();

        this._connection = connection;
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-network-addDataCollector
     */
    async addDataCollector(params: BiDiNetworkAddDataCollectorParameters): Promise<BiDiNetworkAddDataCollectorResult> {
        return this._connection.request("network.addDataCollector", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-network-addIntercept
     */
    async addIntercept(params: BiDiNetworkAddInterceptParameters): Promise<BiDiNetworkAddInterceptResult> {
        return this._connection.request("network.addIntercept", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-network-continueRequest
     */
    async continueRequest(params: BiDiNetworkContinueRequestParameters): Promise<BiDiNetworkContinueRequestResult> {
        return this._connection.request("network.continueRequest", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-network-continueResponse
     */
    async continueResponse(params: BiDiNetworkContinueResponseParameters): Promise<BiDiNetworkContinueResponseResult> {
        return this._connection.request("network.continueResponse", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-network-continueWithAuth
     */
    async continueWithAuth(params: BiDiNetworkContinueWithAuthParameters): Promise<BiDiNetworkContinueWithAuthResult> {
        return this._connection.request("network.continueWithAuth", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-network-disownData
     */
    async disownData(params: BiDiNetworkDisownDataParameters): Promise<BiDiNetworkDisownDataResult> {
        return this._connection.request("network.disownData", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-network-failRequest
     */
    async failRequest(params: BiDiNetworkFailRequestParameters): Promise<BiDiNetworkFailRequestResult> {
        return this._connection.request("network.failRequest", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-network-getData
     */
    async getData(params: BiDiNetworkGetDataParameters): Promise<BiDiNetworkGetDataResult> {
        return this._connection.request("network.getData", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-network-provideResponse
     */
    async provideResponse(params: BiDiNetworkProvideResponseParameters): Promise<BiDiNetworkProvideResponseResult> {
        return this._connection.request("network.provideResponse", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-network-removeDataCollector
     */
    async removeDataCollector(
        params: BiDiNetworkRemoveDataCollectorParameters,
    ): Promise<BiDiNetworkRemoveDataCollectorResult> {
        return this._connection.request("network.removeDataCollector", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-network-removeIntercept
     */
    async removeIntercept(params: BiDiNetworkRemoveInterceptParameters): Promise<BiDiNetworkRemoveInterceptResult> {
        return this._connection.request("network.removeIntercept", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-network-setCacheBehavior
     */
    async setCacheBehavior(params: BiDiNetworkSetCacheBehaviorParameters): Promise<BiDiNetworkSetCacheBehaviorResult> {
        return this._connection.request("network.setCacheBehavior", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-network-setExtraHeaders
     */
    async setExtraHeaders(params: BiDiNetworkSetExtraHeadersParameters): Promise<BiDiNetworkSetExtraHeadersResult> {
        return this._connection.request("network.setExtraHeaders", params);
    }
}
