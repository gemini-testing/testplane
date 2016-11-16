'use strict';

const _ = require('lodash');

const shouldBeSkipped = (browserId, matchers) => {
    return [].concat(matchers)
        .some(matcher => {
            return _.isRegExp(matcher)
                ? matcher.test(browserId)
                : _.isEqual(matcher, browserId);
        });
};

module.exports = class SkipBuilder {
    constructor(skipObj, browserId) {
        this._skip = skipObj;
        this._currentBrowserId = browserId;
    }

    in(matcher, comment, opts) {
        return this._processSkip(matcher, comment, opts);
    }

    notIn(matcher, comment, opts) {
        opts = _.extend(opts || {}, {negate: true});
        return this._processSkip(matcher, comment, opts);
    }

    _processSkip(matcher, comment, opts) {
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
