import { BaseError } from "./base.js";
interface LoadPageErrorData {
    message?: string;
}
type BrowserErrorCtor<T> = new (opts?: LoadPageErrorData) => T;
export declare class LoadPageError extends BaseError {
    static create<T extends LoadPageError>(this: BrowserErrorCtor<T>, opts?: LoadPageErrorData): T;
    constructor({ message }?: LoadPageErrorData);
}
export {};
