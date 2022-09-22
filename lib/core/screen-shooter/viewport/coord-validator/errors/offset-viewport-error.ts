/**
 * Position of an element is outside of a viewport left, top or right bounds
 */
 export default class OffsetViewportError extends Error {
    constructor(message: string) {
        super(message);

        this.name = this.constructor.name;
    }
}
