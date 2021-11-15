import _ from 'lodash';

import { Test, Suite } from '../../types/mocha';

export default class Skip {
    public shouldSkip: boolean;
    public silent: boolean;
    public comment: string;

    constructor() {
        this.shouldSkip = false;
        this.silent = false;
        this.comment = '';
    }

    public handleEntity(entity: Test | Suite): void {
        if (!this.shouldSkip) {
            return;
        }

        if (this.silent) {
            _.extend(entity, {pending: true, silentSkip: true});
        } else {
            _.extend(entity, {pending: true, skipReason: this.comment});
        }

        this._resetInfo();
    }

    private _resetInfo(): void {
        this.shouldSkip = false;
        this.silent = false;
        this.comment = '';
    }
};
