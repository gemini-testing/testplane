"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbortOnReconnectError = void 0;
/**
 * @category Errors
 */
class AbortOnReconnectError extends Error {
    constructor() {
        super("Operation was aborted because client has been reconnected");
        this.name = this.constructor.name;
    }
}
exports.AbortOnReconnectError = AbortOnReconnectError;
//# sourceMappingURL=abort-on-reconnect-error.js.map