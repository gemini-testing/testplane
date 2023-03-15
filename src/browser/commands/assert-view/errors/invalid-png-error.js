"use strict";

module.exports = class InvalidPngError extends Error {
    constructor(message) {
        super();

        this.name = this.constructor.name;
        this.message = message;
    }
};
