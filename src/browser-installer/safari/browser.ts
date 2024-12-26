import _ from "lodash";
import { exec } from "child_process";

export const resolveSafariVersion = _.once(
    () =>
        new Promise<string>((resolve, reject) => {
            const getSafariVersionError = new Error("Couldn't retrive safari version.");

            exec("mdls -name kMDItemVersion /Applications/Safari.app", (err, stdout) => {
                if (err) {
                    reject(getSafariVersionError);
                    return;
                }

                const regExpResult = /kMDItemVersion = "(.*)"/.exec(stdout);

                if (regExpResult && regExpResult[1]) {
                    resolve(regExpResult[1]);
                } else {
                    reject(getSafariVersionError);
                }
            });
        }),
);
