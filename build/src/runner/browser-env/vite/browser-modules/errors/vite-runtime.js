import { BaseError } from "./base.js";
export class ViteRuntimeError extends BaseError {
    file;
    frame;
    tip;
    static create(opts) {
        return new this(opts);
    }
    constructor({ message, stack, file, frame, tip }) {
        super({ message });
        this.stack = `${this.constructor.name}: ${this.message}\n${stack}`;
        this.file = file;
        this.frame = frame;
        this.tip = tip;
    }
}
//# sourceMappingURL=vite-runtime.js.map