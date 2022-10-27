'use strict';

module.exports = class Pool {
    getBrowser() {
        throw new Error('Method must be implemented in child classes');
    }

    freeBrowser() {
        throw new Error('Method must be implemented in child classes');
    }
};
