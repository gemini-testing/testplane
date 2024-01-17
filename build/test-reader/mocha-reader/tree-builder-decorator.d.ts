export class TreeBuilderDecorator {
    static create(...args: any[]): TreeBuilderDecorator;
    constructor(treeBuilder: any);
    addSuite(mochaSuite: any): TreeBuilderDecorator;
    addTest(mochaTest: any): TreeBuilderDecorator;
    addBeforeEachHook(mochaHook: any): TreeBuilderDecorator;
    addAfterEachHook(mochaHook: any): TreeBuilderDecorator;
    addTrap(fn: any): TreeBuilderDecorator;
    addTestFilter(fn: any): TreeBuilderDecorator;
    applyFilters(): TreeBuilderDecorator;
    getRootSuite(): any;
    #private;
}
