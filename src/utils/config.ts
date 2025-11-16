import { BROWSER_TEST_RUN_ENV, NODEJS_TEST_RUN_ENV } from "../constants/config";
import type { CommonConfig } from "../config/types";

export const isRunInNodeJsEnv = (config: CommonConfig): boolean => {
    return config.system.testRunEnv === NODEJS_TEST_RUN_ENV;
};

export const isRunInBrowserEnv = (config: CommonConfig): boolean => {
    return (
        (typeof config.system.testRunEnv === "string" && config.system.testRunEnv === BROWSER_TEST_RUN_ENV) ||
        (Array.isArray(config.system.testRunEnv) && config.system.testRunEnv[0] === BROWSER_TEST_RUN_ENV)
    );
};
