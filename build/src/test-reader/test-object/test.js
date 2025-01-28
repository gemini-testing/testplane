"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Test = void 0;
const configurable_test_object_1 = require("./configurable-test-object");
class Test extends configurable_test_object_1.ConfigurableTestObject {
    static create(opts) {
        return new this(opts);
    }
    constructor({ title, file, id, location, fn }) {
        super({ title, file, id, location });
        this.fn = fn;
    }
    clone() {
        return new Test({
            title: this.title,
            file: this.file,
            id: this.id,
            location: this.location,
            fn: this.fn,
        }).assign(this);
    }
}
exports.Test = Test;
//# sourceMappingURL=test.js.map