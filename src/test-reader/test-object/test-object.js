class TestObject {
    #title;

    static create(...args) {
        return new this(...args);
    }

    constructor({ title }) {
        this.parent = null;

        this.#title = title;
    }

    assign(src) {
        return Object.assign(this, src);
    }

    get title() {
        return this.#title;
    }

    fullTitle() {
        return `${(this.parent && this.parent.fullTitle()) || ""} ${this.title || ""}`.trim();
    }
}

module.exports = {
    TestObject,
};
