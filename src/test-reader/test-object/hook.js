const { TestObject } = require("./test-object");

class Hook extends TestObject {
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

    get type() {
        return "hook";
    }

    get file() {
        return this.parent.file;
    }

    get timeout() {
        return this.parent.timeout;
    }

    get browserId() {
        return this.parent.browserId;
    }
}

module.exports = {
    Hook,
};
