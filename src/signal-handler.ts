import { AsyncEmitter } from "./events";
import { log } from "./utils/logger";
import { MasterEvents } from "./events";

const signalHandler = new AsyncEmitter();

signalHandler.setMaxListeners(0);

let callCount = 0;

let lastCallTime = 0;

const throttleTime = 10;

function notifyAndExit(signalNo: number): (signal: NodeJS.Signals) => void {
    const exitCode = 128 + signalNo;

    return function (signal: NodeJS.Signals) {
        const time = Date.now();

        if (time - lastCallTime < throttleTime) {
            lastCallTime = time;

            return;
        }

        lastCallTime = time;

        if (callCount++ > 0) {
            log("Force quit.");
            process.exit(exitCode);
        }

        const err = new Error(`The process was terminated by a signal: ${signal}`);

        signalHandler.emitAndWait(MasterEvents.EXIT, err).then(() => {
            process.exit(exitCode);
        });
    };
}

process.on("SIGHUP", notifyAndExit(1));
process.on("SIGINT", notifyAndExit(2));
process.on("SIGTERM", notifyAndExit(15));

export default signalHandler;
