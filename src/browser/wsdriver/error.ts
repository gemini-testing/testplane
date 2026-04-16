import {
    WsError,
    WsConnectionEstablishmentError,
    WsConnectionTerminatedError,
    WsTimeoutError,
    WsConnectionBreakError,
} from "../../ws-connection/error";

export class WSDriverError extends WsError {
    isRetryable(): boolean {
        return false;
    }
}

export class WSDriverRequestAgentEstablishmentError extends WsConnectionEstablishmentError {}
export class WSDriverRequestAgentBreakError extends WsConnectionBreakError {}
export class WSDriverRequestAgentTerminatedError extends WsConnectionTerminatedError {}
export class WSDriverRequestAgentTimeoutError extends WsTimeoutError {}
export class WSDriverRequestTimeoutError extends WsTimeoutError {
    isRetryable(): boolean {
        // Webdriverio manages timeouted requests on its own
        return false;
    }
}
export class WSDriverRequestError extends WsError {
    isRetryable(): boolean {
        return true;
    }
}
