'use strict';

module.exports = class AssertViewError extends Error {
    constructor() {
        super();

        this.name = this.constructor.name;
        this.message = 'image comparison failed';
    }
};
