import { CDP_ERROR_CODE } from "./constants";
import type { CDPRequestId } from "./types";

export class CDPError extends Error {
    public code?: number;
    public requestId?: CDPRequestId;

    constructor({ message, code, requestId }: { message: string; code?: number; requestId?: CDPRequestId }) {
        let errorMessage = message;

        if (code) {
            errorMessage += `\n\tErrorCode: ${code}`;
        }

        if (requestId) {
            errorMessage += `\n\tCDP Request ID: ${requestId}`;
        }

        super(errorMessage);

        this.name = this.constructor.name;
        this.code = code;
        this.requestId = requestId;
    }

    isNonRetryable(): boolean {
        // JSON-RPC Protocol Errors
        // CDP State/Execution Errors
        // https://www.jsonrpc.org/specification#error_object
        return Boolean(this.code && ((this.code >= -32700 && this.code <= -32600) || this.code === -32000));
    }
}

export class CDPTimeoutError extends CDPError {
    constructor({ message, requestId }: { message: string; requestId?: CDPRequestId }) {
        super({ message, code: CDP_ERROR_CODE.TIMEOUT, requestId });

        this.name = this.constructor.name;
    }
}

export class CDPConnectionTerminatedError extends CDPError {
    constructor({
        message = "CDP connection was manually closed",
        requestId,
    }: { message?: string; requestId?: CDPRequestId } = {}) {
        super({ message, code: CDP_ERROR_CODE.CONNECTION_TERMINATED, requestId });

        this.name = this.constructor.name;
    }
}
