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

    titlePath() {
        if (this.parent) {
            const parentTitlePath = this.parent.titlePath();

            return this.title ? parentTitlePath.concat(this.title) : parentTitlePath;
        }

        return this.title ? [this.title] : [];
    }

    fullTitle() {
        return this.titlePath().join(" ");
    }
}

module.exports = {
    TestObject,
};
