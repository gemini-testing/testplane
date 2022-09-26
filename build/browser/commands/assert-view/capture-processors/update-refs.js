'use strict';
const fs = require('fs-extra');
const WorkerRunnerEvents = require('../../../../worker/constants/runner-events');
exports.handleNoRefImage = exports.handleImageDiff = async (currImg, refImg, state, { emitter }) => {
    await fs.copy(currImg.path, refImg.path);
    emitter.emit(WorkerRunnerEvents.UPDATE_REFERENCE, { state, refImg });
};
