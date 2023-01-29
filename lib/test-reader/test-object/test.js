const {ConfigurableTestObject} = require('./configurable-test-object');

class Test extends ConfigurableTestObject {
    constructor({title, file, id, fn}) {
        super({title, file, id});

        this.fn = fn;
    }

    clone() {
        return new Test({
            title: this.title,
            file: this.file,
            id: this.id,
            fn: this.fn
        }).assign(this);
    }

    get type() {
        return 'test';
    }
}

module.exports = {
    Test
};
