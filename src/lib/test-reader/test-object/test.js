const { ConfigurableTestObject } = require("./configurable-test-object");

class Test extends ConfigurableTestObject {
    constructor({ title, file, id, fn }) {
        super({ title, file, id });

        this.fn = fn;
    }

    get type() {
        return "test";
    }
}

module.exports = {
    Test,
};
