export = Pool;
declare class Pool {
    /**
     * @returns {Promise.<Browser>}
     */
    getBrowser(): Promise<Browser>;
    /**
     * @param {Browser} browser
     * @returns {Promise}
     */
    freeBrowser(): Promise<any>;
    cancel(): void;
}
