'use strict';

module.exports = class OnlyBuilder {
    constructor(skipBuilder) {
        this._skipBuilder = skipBuilder;
    }

    in(matcher) {
        return this._skipBuilder.notIn(matcher, '', {silent: true});
    }

    notIn(matcher) {
        return this._skipBuilder.in(matcher, '', {silent: true});
    }
};
