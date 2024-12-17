import _ from "lodash";
import calcLevenshtein from "js-levenshtein";
import { readElf, aptFileSearch } from "./ubuntu";

export const searchSharedObjectPackage = async (sharedObject: string): Promise<string> => {
    const aptFileResult = await aptFileSearch(sharedObject);

    const packages = aptFileResult.split("\n").filter(Boolean);

    if (packages.includes("libc6")) {
        return "libc6";
    }

    const relevantPackageName = _.minBy(packages, packageName => calcLevenshtein(sharedObject, packageName)) as string;

    return relevantPackageName;
};

export const getBinarySharedObjectDependencies = async (binaryPath: string): Promise<string[]> => {
    const sharedObjectRegExp = /^\s*\dx\d+\s\(NEEDED\)\s*Shared library: \[(.*)\]/gm;

    const readElfResult = await readElf(binaryPath, { dynamic: true });

    let regExpResult = sharedObjectRegExp.exec(readElfResult);
    const sharedObjectDependencies: string[] = [];

    while (regExpResult && regExpResult[1]) {
        sharedObjectDependencies.push(regExpResult[1]);

        regExpResult = sharedObjectRegExp.exec(readElfResult);
    }

    return sharedObjectDependencies;
};
