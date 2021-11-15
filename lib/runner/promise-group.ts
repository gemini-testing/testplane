export default class PromiseGroup {
    private _count: number;
    private _fulfilledCount: number;
    private _promise: Promise<any>;
    private _resolve: (value?: any) => void = () => {};
    private _reject: (reason?: any) => void = () => {};

    constructor() {
        this._count = 0;
        this._fulfilledCount = 0;

        this._promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }

    public async add<T>(promise: Promise<T>): Promise<void> {
        if (this.isFulfilled()) {
            throw new Error('Can not add promise to a fulfilled group');
        }

        this._count += 1;

        try {
            await promise;
        } catch (err) {
            this._reject(err);
        }

        this._fulfilledCount += 1;

        if (this._count === this._fulfilledCount) {
            this._resolve();
        }
    }

    public isFulfilled(): boolean {
        return this._count > 0 && this._count === this._fulfilledCount;
    }

    public done(): Promise<void> {
        return this._count > 0 ? this._promise : Promise.resolve();
    }
};
