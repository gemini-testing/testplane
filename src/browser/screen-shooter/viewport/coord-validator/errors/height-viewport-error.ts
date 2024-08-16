/**
 * Height of the element is larger than viewport
 * @category Errors
 */
export class HeightViewportError extends Error {
    constructor(message: string) {
        super(message);

        this.name = this.constructor.name;
    }
}
