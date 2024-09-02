/**
 * @category Errors
 */
export class CoreError extends Error {
    name = "CoreError";

    constructor(message: string) {
        super(message);
    }
}
