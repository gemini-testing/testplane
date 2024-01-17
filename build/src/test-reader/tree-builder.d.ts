export class TreeBuilder {
    addSuite(suite: any, parent?: null): this;
    addTest(test: any, parent: any): this;
    addBeforeEachHook(hook: any, parent: any): this;
    addAfterEachHook(hook: any, parent: any): this;
    addTrap(fn: any): this;
    addTestFilter(fn: any): this;
    applyFilters(): this;
    getRootSuite(): any;
    #private;
}
