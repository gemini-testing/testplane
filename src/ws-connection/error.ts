import { WS_ERROR_CODE } from "./constants";

export abstract class WsError extends Error {
    public code?: number;
    public requestId?: number;

    constructor({ message, code, requestId }: { message: string; code?: number; requestId?: number }) {
        let errorMessage = message;

        if (code) {
            errorMessage += `\n\tErrorCode: ${code}`;
        }

        if (requestId) {
            errorMessage += `\n\tRequest ID: ${requestId}`;
        }

        super(errorMessage);

        this.name = this.constructor.name;
        this.code = code;
        this.requestId = requestId;
    }

    abstract isRetryable(): boolean;
}

export class WsConnectionEstablishmentError extends WsError {
    constructor({ message, requestId }: { message: string; requestId?: number }) {
        super({ message, code: WS_ERROR_CODE.CONNECTION_ESTABLISHMENT, requestId });

        this.name = this.constructor.name;
    }

    isRetryable(): boolean {
        return true;
    }
}

export class WsConnectionBreakError extends WsError {
    constructor({ message = "WS connection interrupted", requestId }: { message: string; requestId?: number }) {
        super({ message, code: WS_ERROR_CODE.CONNECTION_BREAK, requestId });

        this.name = this.constructor.name;
    }

    isRetryable(): boolean {
        return true;
    }
}

export class WsConnectionTerminatedError extends WsError {
    constructor({
        message = "WS connection was manually closed",
        requestId,
    }: { message?: string; requestId?: number } = {}) {
        super({ message, code: WS_ERROR_CODE.CONNECTION_TERMINATED, requestId });

        this.name = this.constructor.name;
    }

    isRetryable(): boolean {
        return false;
    }
}

export class WsTimeoutError extends WsError {
    constructor({ message, requestId }: { message: string; requestId?: number }) {
        super({ message, code: WS_ERROR_CODE.TIMEOUT, requestId });

        this.name = this.constructor.name;
    }

    isRetryable(): boolean {
        return true;
    }
}

export class WsConnectionTimeoutError extends WsTimeoutError {
    constructor({ message }: { message: string }) {
        super({ message });

        this.name = this.constructor.name;
    }

    isRetryable(): boolean {
        return true;
    }
}

export class WsRequestTimeoutError extends WsTimeoutError {
    constructor({ message, requestId }: { message: string; requestId?: number }) {
        super({ message, requestId });

        this.name = this.constructor.name;
    }

    isRetryable(): boolean {
        return true;
    }
}
