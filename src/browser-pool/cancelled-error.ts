export class CancelledError extends Error {
    name = "CancelledError";
    message = "Browser request was cancelled";

    constructor() {
        super();
        Error.captureStackTrace(this, CancelledError);
    }
}
