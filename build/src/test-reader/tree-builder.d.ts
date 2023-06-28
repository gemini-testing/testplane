export class TreeBuilder {
    addSuite(suite: any, parent?: null): TreeBuilder;
    addTest(test: any, parent: any): TreeBuilder;
    addBeforeEachHook(hook: any, parent: any): TreeBuilder;
    addAfterEachHook(hook: any, parent: any): TreeBuilder;
    addTrap(fn: any): TreeBuilder;
    addTestFilter(fn: any): TreeBuilder;
    applyFilters(): TreeBuilder;
    getRootSuite(): any;
    #private;
}
