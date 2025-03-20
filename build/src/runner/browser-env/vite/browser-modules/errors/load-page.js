import { BaseError } from "./base.js";
export class LoadPageError extends BaseError {
    static create(opts) {
        return new this(opts);
    }
    constructor({ message = "failed to load Vite test page" } = {}) {
        super({ message });
    }
}
//# sourceMappingURL=load-page.js.map