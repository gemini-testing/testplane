import { AsyncEmitter } from "./events/async-emitter/index.js";
import logger from "./utils/logger.js";

const signalHandler = new AsyncEmitter();

signalHandler.setMaxListeners(0);

export default signalHandler;

process.on("SIGHUP", notifyAndExit(1));
process.on("SIGINT", notifyAndExit(2));
process.on("SIGTERM", notifyAndExit(15));

let callCount = 0;

function notifyAndExit(signalNo) {
    const exitCode = 128 + signalNo;

    return function () {
        if (callCount++ > 0) {
            logger.log("Force quit.");
            process.exit(exitCode);
        }

        signalHandler.emitAndWait("exit").then(function () {
            process.exit(exitCode);
        });
    };
}
