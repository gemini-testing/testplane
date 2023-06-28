export class TestObject {
    static create(...args: any[]): TestObject;
    constructor({ title }: {
        title: any;
    });
    parent: any;
    assign(src: any): any;
    get title(): any;
    fullTitle(): string;
    #private;
}
