"use strict";
module.exports = class PromiseGroup {
    constructor() {
        this._count = 0;
        this._fulfilledCount = 0;
        this._promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }
    add(promise) {
        if (this.isFulfilled()) {
            throw new Error("Can not add promise to a fulfilled group");
        }
        this._count += 1;
        return promise
            .then(() => {
            this._fulfilledCount += 1;
            if (this._count === this._fulfilledCount) {
                this._resolve();
            }
        })
            .catch(this._reject);
    }
    isFulfilled() {
        return this._count > 0 && this._count === this._fulfilledCount;
    }
    done() {
        return this._count > 0 ? this._promise : Promise.resolve();
    }
};
//# sourceMappingURL=promise-group.js.map