export = TestParserAPI;
declare class TestParserAPI {
    static create(...args: any[]): import("./test-parser-api");
    constructor(ctx: any, eventBus: any);
    setController(namespace: any, methods: any): void;
    #private;
}
