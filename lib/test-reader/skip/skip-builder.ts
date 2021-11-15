import _ from 'lodash';

import type Skip from './index';

const shouldBeSkipped = (browserId: string, matchers: string | RegExp): boolean => {
    return ([] as Array<string | RegExp>).concat(matchers)
        .some(matcher => {
            return _.isRegExp(matcher)
                ? matcher.test(browserId)
                : _.isEqual(matcher, browserId);
        });
};

type ProcessSkipOpts = {
    negate?: boolean;
    silent?: boolean;
};

export default class SkipBuilder {
    private _skip: Skip;
    private _currentBrowserId: string;

    constructor(skipObj: Skip, browserId: string) {
        this._skip = skipObj;
        this._currentBrowserId = browserId;
    }

    public in(matcher: string | RegExp, comment: string, opts?: ProcessSkipOpts): this {
        return this._processSkip(matcher, comment, opts);
    }

    public notIn(matcher: string | RegExp, comment: string, opts?: ProcessSkipOpts): this {
        opts = _.extend(opts || {}, {negate: true});
        return this._processSkip(matcher, comment, opts);
    }

    private _processSkip(matcher: string | RegExp, comment: string, opts?: ProcessSkipOpts): this {
        opts = _.defaults(opts || {}, {
            negate: false,
            silent: false
        });

        const skipFunc = opts.negate ? _.negate(shouldBeSkipped) : shouldBeSkipped;
        const shouldSkip = skipFunc(this._currentBrowserId, matcher);
        this._skip.shouldSkip = shouldSkip || this._skip.shouldSkip;

        if (shouldSkip) {
            this._skip.comment = comment;
            this._skip.silent = opts.silent === true;
        }

        return this;
    }
};
