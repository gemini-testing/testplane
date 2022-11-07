'use strict';
module.exports = class CoreError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CoreError';
    }
};
