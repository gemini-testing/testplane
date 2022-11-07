'use strict';
/**
 * @singleton
 */
class RuntimeConfig {
    static create() {
        return new RuntimeConfig();
    }
    extend(data) {
        Object.assign(this, data);
        return this;
    }
}
let runtimeConfig;
exports.getInstance = () => {
    if (!runtimeConfig) {
        runtimeConfig = RuntimeConfig.create();
    }
    return runtimeConfig;
};
