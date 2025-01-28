import { BaseError } from "./base.js";
export class BrowserError extends BaseError {
    file;
    static create(opts) {
        return new this(opts);
    }
    constructor({ message, stack, file }) {
        super({ message, stack });
        if (file) {
            this.file = file;
        }
    }
}
//# sourceMappingURL=browser.js.map