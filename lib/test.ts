type TestOpts = {
    title?: string;
    file?: string;
};

export default class Test {
    private _title?: string;
    public file?: string;

    static create(opts: TestOpts): Test {
        return new this(opts);
    }

    constructor({title, file}: TestOpts = {}) {
        this._title = title;
        this.file = file;
    }

    fullTitle() {

    }
};
