'use strict';

const AsyncEmitter = require('./core/events/async-emitter').default;
const {log} = require('./utils/logger');
const signalHandler = new AsyncEmitter();

signalHandler.setMaxListeners(0);

module.exports = signalHandler;

process.on('SIGHUP', notifyAndExit(1));
process.on('SIGINT', notifyAndExit(2));
process.on('SIGTERM', notifyAndExit(15));

let callCount = 0;

function notifyAndExit(signalNo) {
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
