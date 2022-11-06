'use strict';

module.exports = class ClientBridgeError extends Error {
    constructor(message) {
        super(message);

        this.name = this.constructor.name;
    }
};
