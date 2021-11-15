import BaseStateError from './errors/base-state-error';
import ImageDiffError from './errors/image-diff-error';
import NoRefImageError from './errors/no-ref-image-error';

type T = object | Error;

export default class AssertViewResults {
    static fromRawObject(results) {
        return AssertViewResults.create(results.map((res) => {
            return res.name === ImageDiffError.name && ImageDiffError.fromObject(res)
                || res.name === NoRefImageError.name && NoRefImageError.fromObject(res)
                || res;
        }));
    }

    static create(results: Array<BaseStateError>): AssertViewResults {
        return new AssertViewResults(results);
    }

    constructor(private _results: Array<BaseStateError> = []) {}

    public add(data: BaseStateError): void {
        this._results.push(data);
    }

    public hasFails(): boolean {
        return this._results.some((res) => res instanceof Error);
    }

    public hasState(stateName: string) {
        return this._results.some((res) => res.stateName === stateName);
    }

    public toRawObject() {
        return this._results.map((res) => ({...res}));
    }

    public get() {
        return this._results;
    }
};
