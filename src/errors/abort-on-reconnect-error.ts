/**
 * @category Errors
 */
export class AbortOnReconnectError extends Error {
    constructor() {
        super("Operation was aborted because client has been reconnected");

        this.name = this.constructor.name;
    }
}
