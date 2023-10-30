"use strict";
module.exports = class AssertViewError extends Error {
    constructor(message) {
        super();
        this.name = this.constructor.name;
        this.message = message || "image comparison failed";
    }
};
//# sourceMappingURL=assert-view-error.js.map