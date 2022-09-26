"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ClientBridgeError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}
exports.default = ClientBridgeError;
;
