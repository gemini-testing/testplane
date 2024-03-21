import { BaseError } from "./base.js";

interface ViteRuntimeErrorData {
    message: string;
    stack: string;
    file: string;
    frame: string;
    tip: string;
}

type ViteRuntimeErrorCtor<T> = new (opts: ViteRuntimeErrorData) => T;

export class ViteRuntimeError extends BaseError {
    file: string;
    frame: string;
    tip: string;

    static create<T extends ViteRuntimeError>(this: ViteRuntimeErrorCtor<T>, opts: ViteRuntimeErrorData): T {
        return new this(opts);
    }

    constructor({ message, stack, file, frame, tip }: ViteRuntimeErrorData) {
        super({ message });

        this.stack = `${this.constructor.name}: ${this.message}\n${stack}`;
        this.file = file;
        this.frame = frame;
        this.tip = tip;
    }
}
