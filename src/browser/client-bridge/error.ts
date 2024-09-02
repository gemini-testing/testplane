/**
 * @category Errors
 */
export class ClientBridgeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}
