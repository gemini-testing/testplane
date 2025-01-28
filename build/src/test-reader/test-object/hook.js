"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Hook = void 0;
const test_object_1 = require("./test-object");
class Hook extends test_object_1.TestObject {
    static create(opts) {
        return new this(opts);
    }
    constructor({ title, fn }) {
        super({ title });
        this.fn = fn;
    }
    clone() {
        return new Hook({
            title: this.title,
            fn: this.fn,
        }).assign(this);
    }
    get file() {
        return this.parent ? this.parent.file : "";
    }
    get timeout() {
        return this.parent ? this.parent.timeout : 0;
    }
    get browserId() {
        return this.parent ? this.parent.browserId : "";
    }
}
exports.Hook = Hook;
//# sourceMappingURL=hook.js.map