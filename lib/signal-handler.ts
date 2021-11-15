import { events } from 'gemini-core';
import { log } from './utils/logger';

const signalHandler = new events.AsyncEmitter();

signalHandler.setMaxListeners(0);

export default signalHandler;

process.on('SIGHUP', notifyAndExit(1));
process.on('SIGINT', notifyAndExit(2));
process.on('SIGTERM', notifyAndExit(15));

let callCount = 0;

function notifyAndExit(signalNo: number): NodeJS.SignalsListener {
    const exitCode = 128 + signalNo;

    return function() {
        if (callCount++ > 0) {
            log('Force quit.');
            process.exit(exitCode);
        }

        signalHandler.emitAndWait('exit')
            .then(function() {
                process.exit(exitCode);
            })
            .done();
    };
}
