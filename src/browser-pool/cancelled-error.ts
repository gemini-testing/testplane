/**
 * @category Errors
 */
export class CancelledError extends Error {
    name = "CancelledError";
    message = `Browser request was cancelled

What happened:
- This test tried to run in a browser that was already stopped
- This likely happened due to a critical error, like an unhandled promise rejection
What you can do:
- Check other failed tests or execution logs for more details, usually you can find the root cause there`;

    constructor() {
        super();
        Error.captureStackTrace(this, CancelledError);
    }
}
