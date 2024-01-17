export = SetCollection;
declare class SetCollection {
    static create(sets: any): import("./set-collection");
    constructor(sets: any);
    groupByFile(): _.Dictionary<any[]>;
    getAllFiles(): any[];
    groupByBrowser(): _.Dictionary<any[]>;
    #private;
}
import _ = require("lodash");
