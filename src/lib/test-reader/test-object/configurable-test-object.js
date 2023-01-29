const { TestObject } = require("./test-object");
const _ = require("lodash");

class ConfigurableTestObject extends TestObject {
    #data;

    constructor({ title, file, id }) {
        super({ title });

        this.#data = { id, file };
    }

    skip({ reason }) {
        this.pending = true;
        this.skipReason = reason;
    }

    disable() {
        this.disabled = true;
        this.silentSkip = true;
    }

    get id() {
        const id = () => this.#data.id;
        id.toString = () => this.#data.id;

        return id;
    }

    get file() {
        return this.#data.file;
    }

    set pending(val) {
        this.#data.pending = val;
    }

    get pending() {
        return this.#getInheritedProperty("pending", false);
    }

    set skipReason(reason) {
        this.#data.skipReason = reason;
    }

    get skipReason() {
        return this.#getInheritedProperty("skipReason", "");
    }

    set disabled(val) {
        this.#data.disabled = val;
    }

    get disabled() {
        return this.#getInheritedProperty("disabled", false);
    }

    set silentSkip(val) {
        this.#data.silentSkip = val;
    }

    get silentSkip() {
        return this.#getInheritedProperty("silentSkip", false);
    }

    set timeout(timeout) {
        this.#data.timeout = timeout;
    }

    get timeout() {
        return this.#getInheritedProperty("timeout", 0);
    }

    set browserId(id) {
        this.#data.browserId = id;
    }

    get browserId() {
        return this.#getInheritedProperty("browserId", "");
    }

    set browserVersion(version) {
        this.#data.browserVersion = version;
    }

    get browserVersion() {
        return this.#getInheritedProperty("browserVersion", "");
    }

    get hasBrowserVersionOverwritten() {
        return Boolean(this.#data.browserVersion);
    }

    #getInheritedProperty(name, defaultValue) {
        return this.#data[name] === undefined
            ? _.get(this.parent, name, defaultValue)
            : this.#data[name];
    }
}

module.exports = {
    ConfigurableTestObject,
};
