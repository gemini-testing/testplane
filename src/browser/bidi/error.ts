import {
    WsError,
    WsConnectionEstablishmentError,
    WsConnectionTerminatedError,
    WsConnectionBreakError,
    WsConnectionTimeoutError,
    WsRequestTimeoutError,
} from "../../ws-connection/error";

export class BIDIError extends WsError {
    isRetryable(): boolean {
        return false;
    }
}

export class BIDIConnectionEstablishmentError extends WsConnectionEstablishmentError {}
export class BIDIConnectionBreakError extends WsConnectionBreakError {}
export class BIDIConnectionTerminatedError extends WsConnectionTerminatedError {}
export class BIDIConnectionTimeoutError extends WsConnectionTimeoutError {}
export class BIDIRequestTimeoutError extends WsRequestTimeoutError {}

export class BIDIRequestError extends WsError {
    public stacktrace?: string;

    constructor({
        message,
        code,
        requestId,
        stacktrace,
    }: {
        message: string;
        code?: number | string;
        requestId?: number;
        stacktrace?: string;
    }) {
        super({ message, requestId, code });

        this.stacktrace = stacktrace;

        if (stacktrace) {
            this.message += `\n\tStacktrace:\n${stacktrace}`;
        }
    }

    isRetryable(): boolean {
        return (
            this.code === "unknown error" ||
            this.code === "unable to capture screen" ||
            this.code === "unable to close browser"
        );
    }
}
