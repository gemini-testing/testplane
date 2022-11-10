'use strict';

module.exports = class Pool {
    /**
     * @returns {Promise.<Browser>}
     */
    getBrowser() {}

    /**
     * @param {Browser} browser
     * @returns {Promise}
     */
    freeBrowser() {
        return Promise.resolve();
    }

    cancel() {}
};
