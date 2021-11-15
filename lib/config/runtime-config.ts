/**
 * @singleton
 */
class RuntimeConfig {
    [x: string]: any;

    public static create(): RuntimeConfig {
        return new RuntimeConfig();
    }

    public extend(data: object): this {
        Object.assign(this, data);

        return this;
    }
}

let runtimeConfig: RuntimeConfig;

export const getInstance = () => {
    if (!runtimeConfig) {
        runtimeConfig = RuntimeConfig.create();
    }

    return runtimeConfig;
};
