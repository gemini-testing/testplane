export default class Pool {
    /**
     * @returns {Promise.<Browser>}
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    getBrowser() {}

    /**
     * @param {Browser} browser
     * @returns {Promise}
     */
    freeBrowser() {
        return Promise.resolve();
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    cancel() {}
}
