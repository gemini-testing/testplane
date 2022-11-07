'use strict';
module.exports = class Test {
    static create(...args) {
        return new this(...args);
    }
    constructor({ title, file } = {}) {
        this._title = title;
        this.file = file;
    }
    fullTitle() {
    }
};
