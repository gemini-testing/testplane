export class TreeBuilderDecorator {
    static create(...args: any[]): TreeBuilderDecorator;
    constructor(treeBuilder: any);
    addSuite(mochaSuite: any): this;
    addTest(mochaTest: any): this;
    addBeforeEachHook(mochaHook: any): this;
    addAfterEachHook(mochaHook: any): this;
    addTrap(fn: any): this;
    addTestFilter(fn: any): this;
    applyFilters(): this;
    getRootSuite(): any;
    #private;
}
