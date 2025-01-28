export class BaseError extends Error {
    constructor({ message, stack }) {
        super(message);
        this.name = this.constructor.name;
        if (stack) {
            this.stack = stack;
        }
    }
}
//# sourceMappingURL=base.js.map