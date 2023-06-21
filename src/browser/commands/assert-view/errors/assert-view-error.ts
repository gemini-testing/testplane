export class AssertViewError extends Error {
    constructor(public message: string = "image comparison failed") {
        super();

        this.name = this.constructor.name;
    }
}
