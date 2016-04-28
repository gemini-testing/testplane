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

    in(matcher, comment) {
        return this._processSkip(matcher, comment);
    }

    notIn(matcher, comment) {
        return this._processSkip(matcher, comment, {negate: true});
    }

    _processSkip(matcher, comment, opts) {
        const skipFunc = (opts || {}).negate ? _.negate(shouldBeSkipped) : shouldBeSkipped;
        const shouldSkip = skipFunc(this._currentBrowserId, matcher);
        this._skip.shouldSkip = shouldSkip || this._skip.shouldSkip;
        if (shouldSkip) {
            this._skip.comment = comment;
        }

        return this;
    }
};
