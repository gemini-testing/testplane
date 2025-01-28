import { BaseError } from "./base.js";
interface ViteRuntimeErrorData {
    message: string;
    stack: string;
    file: string;
    frame: string;
    tip: string;
}
type ViteRuntimeErrorCtor<T> = new (opts: ViteRuntimeErrorData) => T;
export declare class ViteRuntimeError extends BaseError {
    file: string;
    frame: string;
    tip: string;
    static create<T extends ViteRuntimeError>(this: ViteRuntimeErrorCtor<T>, opts: ViteRuntimeErrorData): T;
    constructor({ message, stack, file, frame, tip }: ViteRuntimeErrorData);
}
export {};
