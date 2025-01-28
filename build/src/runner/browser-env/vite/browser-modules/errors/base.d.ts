export declare class BaseError extends Error {
    constructor({ message, stack }: {
        message: string;
        stack?: string;
    });
}
