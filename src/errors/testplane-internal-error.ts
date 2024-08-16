/**
 * @category Errors
 */
export class TestplaneInternalError extends Error {
    constructor(message: string) {
        super(message);

        this.name = this.constructor.name;
    }
}
