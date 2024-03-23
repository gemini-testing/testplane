import { ImageDiffError } from "./errors/image-diff-error.js";
import { NoRefImageError } from "./errors/no-ref-image-error.js";

export default class AssertViewResults {
    static fromRawObject(results) {
        return AssertViewResults.create(
            results.map(res => {
                return (
                    (res.name === ImageDiffError.name && ImageDiffError.fromObject(res)) ||
                    (res.name === NoRefImageError.name && NoRefImageError.fromObject(res)) ||
                    res
                );
            }),
        );
    }

    static create(results) {
        return new AssertViewResults(results);
    }

    constructor(results) {
        this._results = results || [];
    }

    add(data) {
        this._results.push(data);
    }

    hasFails() {
        return this._results.some(res => res instanceof Error);
    }

    hasState(stateName) {
        return this._results.some(res => res.stateName === stateName);
    }

    toRawObject() {
        return this._results.map(res => ({ ...res }));
    }

    get() {
        return this._results;
    }
}
