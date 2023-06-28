export = HermioneFacade;
declare class HermioneFacade {
    static create(): import("./hermione-facade");
    promise: Promise<void>;
    _hermione: any;
    init(): Promise<void>;
    syncConfig(): Promise<void>;
    runTest(...args: any[]): Promise<any>;
    _init(): Promise<any>;
    _syncConfig(): Promise<any>;
}
import Promise = require("bluebird");
