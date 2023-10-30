export class OnlyController {
    static create(...args: any[]): OnlyController;
    constructor(eventBus: any);
    in(matchers: any): OnlyController;
    notIn(matchers: any): OnlyController;
    #private;
}
