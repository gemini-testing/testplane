/**
 * @category Errors
 */
export class ClientBridgeError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = this.constructor.name;
    }
}
