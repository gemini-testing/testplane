"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientBridgeError = void 0;
/**
 * @category Errors
 */
class ClientBridgeError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}
exports.ClientBridgeError = ClientBridgeError;
//# sourceMappingURL=error.js.map