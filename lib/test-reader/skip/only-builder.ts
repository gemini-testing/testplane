import type SkipBuilder from "./skip-builder";

export default class OnlyBuilder {
    private _skipBuilder: SkipBuilder;
    
    constructor(skipBuilder: SkipBuilder) {
        this._skipBuilder = skipBuilder;
    }

    public in(matcher: string | RegExp): SkipBuilder {
        return this._skipBuilder.notIn(matcher, '', {silent: true});
    }

    notIn(matcher: string | RegExp): SkipBuilder {
        return this._skipBuilder.in(matcher, '', {silent: true});
    }
};
