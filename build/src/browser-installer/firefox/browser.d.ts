import _ from "lodash";
export declare const installFirefox: (version: string, { force, needWebDriver, needUbuntuPackages }?: {
    force?: boolean | undefined;
    needWebDriver?: boolean | undefined;
    needUbuntuPackages?: boolean | undefined;
}) => Promise<string>;
export declare const resolveLatestFirefoxVersion: ((force?: any) => Promise<string>) & _.MemoizedFunction;
