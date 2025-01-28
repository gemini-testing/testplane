import { BaseError } from "./base.js";
interface BrowserErrorData {
    message: string;
    stack?: string;
    file?: string;
}
export declare class BrowserError extends BaseError {
    file?: string;
    static create<T extends BrowserError>(this: new (opts: BrowserErrorData) => T, opts: BrowserErrorData): T;
    constructor({ message, stack, file }: BrowserErrorData);
}
export {};
