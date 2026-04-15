import {
    WsError,
    WsConnectionEstablishmentError,
    WsConnectionTerminatedError,
    WsConnectionBreakError,
    WsConnectionTimeoutError,
    WsRequestTimeoutError,
} from "../../ws-connection/error";

export class CDPError extends WsError {
    isRetryable(): boolean {
        return false;
    }
}

export class CDPConnectionEstablishmentError extends WsConnectionEstablishmentError {}
export class CDPConnectionBreakError extends WsConnectionBreakError {}
export class CDPConnectionTerminatedError extends WsConnectionTerminatedError {}
export class CDPConnectionTimeoutError extends WsConnectionTimeoutError {}
export class CDPRequestTimeoutError extends WsRequestTimeoutError {}

export class CDPRequestError extends WsError {
    isRetryable(): boolean {
        if (!this.code) {
            return true;
        }

        // JSON-RPC Protocol Errors
        // CDP State/Execution Errors
        // https://www.jsonrpc.org/specification#error_object
        return (this.code < -32700 || this.code > -32600) && this.code !== -32000;
    }
}
