"use strict";
module.exports = class BaseInformer {
    static create(...args) {
        return new this(...args);
    }
    log() {
        throw new Error("Method must be implemented in child classes");
    }
    warn() {
        throw new Error("Method must be implemented in child classes");
    }
    error() {
        throw new Error("Method must be implemented in child classes");
    }
    end() {
        throw new Error("Method must be implemented in child classes");
    }
};
//# sourceMappingURL=base.js.map