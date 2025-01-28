import _ from "lodash";
export declare const installChrome: (version: string, { force, needWebDriver, needUbuntuPackages }?: {
    force?: boolean | undefined;
    needWebDriver?: boolean | undefined;
    needUbuntuPackages?: boolean | undefined;
}) => Promise<string>;
export declare const resolveLatestChromeVersion: ((force?: any) => Promise<string>) & _.MemoizedFunction;
